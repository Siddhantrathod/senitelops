#!/usr/bin/env python3
"""
Pipeline Executor Service for SentinelOps
Handles automated security scanning triggered by GitHub webhooks
Supports dynamic external GitHub repository scanning
"""

import os
import sys
import json
import subprocess
import shutil
import tempfile
import logging
import re
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import threading
import uuid
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SentinelOps.Pipeline')

# =============================================================================
# CONFIGURATION
# =============================================================================

# Get base directory (project root)
BASE_DIR = Path(__file__).parent.parent.absolute()
RUNTIME_DIR = BASE_DIR / "runtime"
REPORTS_DIR = RUNTIME_DIR / "reports"
HISTORY_DIR = RUNTIME_DIR / "history"

# Ensure runtime directories exist
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_DIR.mkdir(parents=True, exist_ok=True)

# Default report paths
DEFAULT_BANDIT_REPORT = REPORTS_DIR / "bandit-report.json"
DEFAULT_SAST_REPORT = REPORTS_DIR / "sast-report.json"
DEFAULT_TRIVY_REPORT = REPORTS_DIR / "trivy-report.json"
DEFAULT_GITLEAKS_REPORT = REPORTS_DIR / "gitleaks-report.json"
DEFAULT_DAST_REPORT = REPORTS_DIR / "dast-report.json"
DEFAULT_DECISION_REPORT = REPORTS_DIR / "security_decision.json"

# Temp workspace prefix
WORKSPACE_PREFIX = "sentinelops_scan_"

# Import multi-language SAST scanner
from .sast_scanner import run_sast_scan, detect_languages, LANGUAGE_INFO

# Import Gitleaks and DAST scanners
from .gitleaks_scanner import run_secrets_scan
from .dast_scanner import run_dast_scan

class StageStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"

class PipelineStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class PipelineStage:
    name: str
    status: StageStatus
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    logs: str = ""
    error: Optional[str] = None

@dataclass
class PipelineRun:
    id: str
    repo_name: str
    branch: str
    commit_sha: str
    commit_message: str
    author: str
    status: PipelineStatus
    triggered_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    stages: Dict[str, Dict] = None
    security_score: Optional[int] = None
    is_deployable: Optional[bool] = None
    vulnerability_summary: Optional[Dict] = None

    def __post_init__(self):
        if self.stages is None:
            self.stages = {}

    def to_dict(self):
        return {
            "id": self.id,
            "repo_name": self.repo_name,
            "branch": self.branch,
            "commit_sha": self.commit_sha,
            "commit_message": self.commit_message,
            "author": self.author,
            "status": self.status.value if isinstance(self.status, PipelineStatus) else self.status,
            "triggered_at": self.triggered_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_seconds": self.duration_seconds,
            "stages": self.stages,
            "security_score": self.security_score,
            "is_deployable": self.is_deployable,
            "vulnerability_summary": self.vulnerability_summary
        }


class PipelineExecutor:
    """Executes security scanning pipeline"""
    
    def __init__(self, reports_dir: str, pipelines_file: str):
        self.reports_dir = reports_dir
        self.pipelines_file = pipelines_file
        self.current_runs: Dict[str, PipelineRun] = {}
        self._load_pipelines()
        
    def _load_pipelines(self):
        """Load pipeline history from file"""
        try:
            if os.path.exists(self.pipelines_file):
                with open(self.pipelines_file, 'r') as f:
                    data = json.load(f)
                    self.pipeline_history = data.get('pipelines', [])
            else:
                self.pipeline_history = []
        except Exception as e:
            print(f"Error loading pipelines: {e}")
            self.pipeline_history = []
    
    def _save_pipelines(self):
        """Save pipeline history to file"""
        try:
            os.makedirs(os.path.dirname(self.pipelines_file), exist_ok=True)
            with open(self.pipelines_file, 'w') as f:
                json.dump({
                    'pipelines': self.pipeline_history[-50:],  # Keep last 50 runs
                    'updated_at': datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            print(f"Error saving pipelines: {e}")
    
    def create_pipeline(self, repo_url: str, branch: str, commit_sha: str, 
                       commit_message: str, author: str) -> PipelineRun:
        """Create a new pipeline run"""
        pipeline_id = str(uuid.uuid4())[:8]
        repo_name = repo_url.split('/')[-1].replace('.git', '') if repo_url else 'local'
        
        pipeline = PipelineRun(
            id=pipeline_id,
            repo_name=repo_name,
            branch=branch,
            commit_sha=commit_sha[:7] if commit_sha else 'local',
            commit_message=commit_message[:100] if commit_message else 'Manual trigger',
            author=author,
            status=PipelineStatus.QUEUED,
            triggered_at=datetime.now().isoformat(),
            stages={
                "clone": {"name": "Clone Repository", "status": StageStatus.PENDING.value},
                "build": {"name": "Build Image", "status": StageStatus.PENDING.value},
                "sast_scan": {"name": "SAST Security Scan", "status": StageStatus.PENDING.value},
                "gitleaks_scan": {"name": "Secret Detection (Gitleaks)", "status": StageStatus.PENDING.value},
                "trivy_scan": {"name": "Trivy Container Scan", "status": StageStatus.PENDING.value},
                "dast_scan": {"name": "DAST Security Scan (ZAP)", "status": StageStatus.PENDING.value},
                "policy_check": {"name": "Policy Evaluation", "status": StageStatus.PENDING.value},
                "decision": {"name": "Deployment Decision", "status": StageStatus.PENDING.value}
            }
        )
        
        self.current_runs[pipeline_id] = pipeline
        self.pipeline_history.insert(0, pipeline.to_dict())
        self._save_pipelines()
        
        return pipeline
    
    def update_stage(self, pipeline_id: str, stage_name: str, 
                    status: StageStatus, logs: str = "", error: str = None):
        """Update a pipeline stage status"""
        if pipeline_id in self.current_runs:
            pipeline = self.current_runs[pipeline_id]
            if stage_name in pipeline.stages:
                pipeline.stages[stage_name]["status"] = status.value
                pipeline.stages[stage_name]["logs"] = logs
                if error:
                    pipeline.stages[stage_name]["error"] = error
                if status == StageStatus.RUNNING:
                    pipeline.stages[stage_name]["started_at"] = datetime.now().isoformat()
                elif status in [StageStatus.SUCCESS, StageStatus.FAILED]:
                    pipeline.stages[stage_name]["finished_at"] = datetime.now().isoformat()
                    if pipeline.stages[stage_name].get("started_at"):
                        start = datetime.fromisoformat(pipeline.stages[stage_name]["started_at"])
                        end = datetime.fromisoformat(pipeline.stages[stage_name]["finished_at"])
                        pipeline.stages[stage_name]["duration_seconds"] = (end - start).total_seconds()
            
            # Update history
            for i, p in enumerate(self.pipeline_history):
                if p['id'] == pipeline_id:
                    self.pipeline_history[i] = pipeline.to_dict()
                    break
            self._save_pipelines()
    
    def run_pipeline(self, pipeline: PipelineRun, repo_url: str = None, 
                    target_dir: str = None, image_name: str = None):
        """Execute the full pipeline"""
        pipeline.status = PipelineStatus.RUNNING
        pipeline.started_at = datetime.now().isoformat()
        self._save_pipelines()
        
        work_dir = target_dir or tempfile.mkdtemp(prefix="sentinelops_")
        cleanup_dir = target_dir is None
        
        try:
            # Stage 1: Clone Repository
            if repo_url:
                self.update_stage(pipeline.id, "clone", StageStatus.RUNNING)
                try:
                    result = subprocess.run(
                        ["git", "clone", "--depth", "1", "--branch", pipeline.branch, repo_url, work_dir],
                        capture_output=True, text=True, timeout=120
                    )
                    if result.returncode != 0:
                        raise Exception(result.stderr)
                    self.update_stage(pipeline.id, "clone", StageStatus.SUCCESS, 
                                    f"Cloned {repo_url} successfully")
                except Exception as e:
                    self.update_stage(pipeline.id, "clone", StageStatus.FAILED, error=str(e))
                    raise
            else:
                self.update_stage(pipeline.id, "clone", StageStatus.SKIPPED, "Using local directory")
            
            # Stage 2: Build Docker Image
            self.update_stage(pipeline.id, "build", StageStatus.RUNNING)
            dockerfile_path = os.path.join(work_dir, "Dockerfile")
            has_dockerfile = os.path.exists(dockerfile_path)
            built_image_name = None
            
            if has_dockerfile:
                try:
                    build_image = image_name or f"sentinelops-scan-{pipeline.id}"
                    result = subprocess.run(
                        ["docker", "buildx", "build", "--load",
                         "-f", dockerfile_path, "-t", build_image, work_dir],
                        capture_output=True, text=True, timeout=900
                    )
                    if result.returncode != 0:
                        raise Exception(result.stderr)
                    built_image_name = build_image
                    self.update_stage(pipeline.id, "build", StageStatus.SUCCESS,
                                    f"Built image: {build_image}")
                except subprocess.TimeoutExpired:
                    self.update_stage(pipeline.id, "build", StageStatus.FAILED, 
                                    error="Docker build timed out after 900 seconds — continuing with filesystem scans")
                    logger.warning("⚠ Docker build timed out — pipeline will continue without image scans")
                except Exception as e:
                    self.update_stage(pipeline.id, "build", StageStatus.FAILED, error=str(e))
                    logger.warning(f"⚠ Docker build failed: {e} — continuing with filesystem scans")
            else:
                self.update_stage(pipeline.id, "build", StageStatus.SKIPPED, 
                                "No Dockerfile found — Trivy will scan filesystem instead")
            
            # Stage 3: Multi-Language SAST Scan
            self.update_stage(pipeline.id, "sast_scan", StageStatus.RUNNING)
            try:
                sast_report = run_sast_scan(work_dir, self.reports_dir)
                tools_used = [t for t, info in sast_report.get('tools_used', {}).items() if info.get('success')]
                langs = list(sast_report.get('languages_detected', {}).keys())
                total_issues = sast_report.get('metrics', {}).get('totals', {}).get('total', 0)
                self.update_stage(pipeline.id, "sast_scan", StageStatus.SUCCESS,
                                f"SAST scan completed: {total_issues} issues found across {len(langs)} language(s) using {', '.join(tools_used) or 'no tools'}")
            except Exception as e:
                self.update_stage(pipeline.id, "sast_scan", StageStatus.FAILED, error=str(e))
                raise
            
            # Define report paths for later stages
            bandit_report_path = os.path.join(self.reports_dir, "bandit-report.json")
            
            # Stage 4: Gitleaks Secret Detection
            self.update_stage(pipeline.id, "gitleaks_scan", StageStatus.RUNNING)
            try:
                gitleaks_report = run_secrets_scan(work_dir, self.reports_dir)
                secrets_count = gitleaks_report.get('total_secrets', 0)
                tool_used = gitleaks_report.get('tool', 'unknown')
                self.update_stage(pipeline.id, "gitleaks_scan", StageStatus.SUCCESS,
                                f"Secret scan ({tool_used}): {secrets_count} secret(s) found")
            except Exception as e:
                self.update_stage(pipeline.id, "gitleaks_scan", StageStatus.FAILED, error=str(e))
                # Don't fail pipeline for gitleaks errors
                logger.warning(f"Gitleaks scan failed: {e}")
                gitleaks_report = {}
            
            # Stage 5: Trivy Container Scan
            self.update_stage(pipeline.id, "trivy_scan", StageStatus.RUNNING)
            trivy_report_path = os.path.join(self.reports_dir, "trivy-report.json")
            
            try:
                if built_image_name:
                    # Scan the built Docker image
                    scan_target = built_image_name
                    trivy_cmd = ["trivy", "image", "--format", "json", "--output", trivy_report_path, scan_target]
                    scan_mode_msg = f"image scan for {scan_target}"
                else:
                    # No Docker image — scan filesystem for dependency vulnerabilities
                    scan_target = work_dir
                    trivy_cmd = ["trivy", "fs", "--format", "json", "--output", trivy_report_path, scan_target]
                    scan_mode_msg = f"filesystem scan on {os.path.basename(work_dir)}"
                
                result = subprocess.run(
                    trivy_cmd,
                    capture_output=True, text=True, timeout=300
                )
                if result.returncode != 0 and "No such image" not in result.stderr:
                    raise Exception(result.stderr)
                self.update_stage(pipeline.id, "trivy_scan", StageStatus.SUCCESS,
                                f"Trivy {scan_mode_msg} completed")
            except FileNotFoundError:
                self.update_stage(pipeline.id, "trivy_scan", StageStatus.FAILED,
                                error="Trivy not installed")
                raise Exception("Trivy not installed")
            except Exception as e:
                self.update_stage(pipeline.id, "trivy_scan", StageStatus.FAILED, error=str(e))
                raise
            
            # Stage 6: DAST Scan (only if Docker image was built)
            if built_image_name:
                self.update_stage(pipeline.id, "dast_scan", StageStatus.RUNNING)
                try:
                    dockerfile_path = os.path.join(work_dir, "Dockerfile")
                    dast_report = run_dast_scan(
                        target_url=None,
                        reports_dir=self.reports_dir,
                        scan_type="baseline",
                        image_name=built_image_name,
                        dockerfile_path=dockerfile_path if os.path.exists(dockerfile_path) else None,
                    )
                    dast_alerts = dast_report.get('total_alerts', 0)
                    self.update_stage(pipeline.id, "dast_scan", StageStatus.SUCCESS,
                                    f"DAST scan completed: {dast_alerts} alert(s) found")
                except Exception as e:
                    self.update_stage(pipeline.id, "dast_scan", StageStatus.FAILED, error=str(e))
                    logger.warning(f"DAST scan failed: {e}")
                    dast_report = {}
            else:
                self.update_stage(pipeline.id, "dast_scan", StageStatus.SKIPPED,
                                "No Docker image — DAST scan requires a running application")
                dast_report = {}
            
            # Stage 7: Policy Evaluation
            self.update_stage(pipeline.id, "policy_check", StageStatus.RUNNING)
            try:
                gitleaks_report_path = os.path.join(self.reports_dir, "gitleaks-report.json")
                dast_report_path = os.path.join(self.reports_dir, "dast-report.json")
                vuln_summary = self._analyze_vulnerabilities(
                    bandit_report_path, trivy_report_path,
                    gitleaks_path=gitleaks_report_path,
                    dast_path=dast_report_path,
                )
                pipeline.vulnerability_summary = vuln_summary
                pipeline.security_score = vuln_summary.get('security_score', 0)
                self.update_stage(pipeline.id, "policy_check", StageStatus.SUCCESS,
                                f"Security Score: {pipeline.security_score}/100")
            except Exception as e:
                self.update_stage(pipeline.id, "policy_check", StageStatus.FAILED, error=str(e))
                raise
            
            # Stage 8: Deployment Decision
            self.update_stage(pipeline.id, "decision", StageStatus.RUNNING)
            is_deployable = self._evaluate_deployment(pipeline.security_score, vuln_summary)
            pipeline.is_deployable = is_deployable
            
            decision_msg = "✅ APPROVED for deployment" if is_deployable else "❌ BLOCKED - Security requirements not met"
            self.update_stage(pipeline.id, "decision", StageStatus.SUCCESS, decision_msg)
            
            # Generate security decision report
            self._generate_decision_report(pipeline)
            
            # Pipeline completed successfully
            pipeline.status = PipelineStatus.SUCCESS
            pipeline.finished_at = datetime.now().isoformat()
            start = datetime.fromisoformat(pipeline.started_at)
            end = datetime.fromisoformat(pipeline.finished_at)
            pipeline.duration_seconds = (end - start).total_seconds()
            
        except Exception as e:
            pipeline.status = PipelineStatus.FAILED
            pipeline.finished_at = datetime.now().isoformat()
            if pipeline.started_at:
                start = datetime.fromisoformat(pipeline.started_at)
                end = datetime.fromisoformat(pipeline.finished_at)
                pipeline.duration_seconds = (end - start).total_seconds()
        
        finally:
            # Update history
            for i, p in enumerate(self.pipeline_history):
                if p['id'] == pipeline.id:
                    self.pipeline_history[i] = pipeline.to_dict()
                    break
            self._save_pipelines()
            
            # Cleanup
            if cleanup_dir and os.path.exists(work_dir):
                shutil.rmtree(work_dir, ignore_errors=True)
        
        return pipeline
    
    def _analyze_vulnerabilities(self, bandit_path: str, trivy_path: str,
                                   gitleaks_path: str = None, dast_path: str = None) -> Dict[str, Any]:
        """Analyze vulnerability reports and calculate security score.
        
        Reads the unified SAST report (sast-report.json) when available,
        falling back to bandit-report.json for backward compatibility.
        Also integrates Gitleaks (secrets) and DAST (ZAP) results.
        Separates code vulnerabilities (SAST) from base image/dependency
        vulnerabilities (Trivy) and applies different weights.
        """
        summary = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
            'total': 0,
            'sast_issues': 0,
            'bandit_issues': 0,  # backward compat alias
            'trivy_vulns': 0,
            'secrets_found': 0,
            'dast_alerts': 0,
            'security_score': 100,
            'sast_high': 0,
            'sast_medium': 0,
            'sast_low': 0,
            'bandit_high': 0,
            'bandit_medium': 0,
            'bandit_low': 0,
            'trivy_critical': 0,
            'trivy_high': 0,
            'trivy_medium': 0,
            'trivy_low': 0,
            'secrets_critical': 0,
            'secrets_high': 0,
            'secrets_medium': 0,
            'dast_high': 0,
            'dast_medium': 0,
            'dast_low': 0,
            'languages_detected': [],
            'tools_used': [],
        }
        
        # Try unified SAST report first, then fall back to Bandit-only
        sast_report_path = os.path.join(os.path.dirname(bandit_path), 'sast-report.json')
        try:
            if os.path.exists(sast_report_path):
                with open(sast_report_path, 'r') as f:
                    sast_data = json.load(f)
                metrics = sast_data.get('metrics', {}).get('totals', {})
                summary['sast_issues'] = metrics.get('total', 0)
                summary['sast_high'] = metrics.get('high', 0)
                summary['sast_medium'] = metrics.get('medium', 0)
                summary['sast_low'] = metrics.get('low', 0)
                # Backward compat
                summary['bandit_issues'] = summary['sast_issues']
                summary['bandit_high'] = summary['sast_high']
                summary['bandit_medium'] = summary['sast_medium']
                summary['bandit_low'] = summary['sast_low']
                summary['high'] += summary['sast_high']
                summary['medium'] += summary['sast_medium']
                summary['low'] += summary['sast_low']
                summary['languages_detected'] = list(sast_data.get('languages_detected', {}).keys())
                summary['tools_used'] = [t for t, info in sast_data.get('tools_used', {}).items() if info.get('success')]
            else:
                # Fallback: read bandit report directly
                with open(bandit_path, 'r') as f:
                    bandit_data = json.load(f)
                    results = bandit_data.get('results', [])
                    summary['sast_issues'] = len(results)
                    summary['bandit_issues'] = len(results)
                    for issue in results:
                        severity = issue.get('issue_severity', '').upper()
                        if severity == 'HIGH':
                            summary['high'] += 1
                            summary['sast_high'] += 1
                            summary['bandit_high'] += 1
                        elif severity == 'MEDIUM':
                            summary['medium'] += 1
                            summary['sast_medium'] += 1
                            summary['bandit_medium'] += 1
                        elif severity == 'LOW':
                            summary['low'] += 1
                            summary['sast_low'] += 1
                            summary['bandit_low'] += 1
        except Exception as e:
            print(f"Error reading SAST/Bandit report: {e}")
        
        # Analyze Trivy report (image/dependency vulnerabilities)
        try:
            with open(trivy_path, 'r') as f:
                trivy_data = json.load(f)
                results = trivy_data.get('Results', [])
                
                for result in results:
                    vulns = result.get('Vulnerabilities', []) or []
                    summary['trivy_vulns'] += len(vulns)
                    
                    for vuln in vulns:
                        severity = vuln.get('Severity', '').upper()
                        if severity == 'CRITICAL':
                            summary['critical'] += 1
                            summary['trivy_critical'] += 1
                        elif severity == 'HIGH':
                            summary['high'] += 1
                            summary['trivy_high'] += 1
                        elif severity == 'MEDIUM':
                            summary['medium'] += 1
                            summary['trivy_medium'] += 1
                        elif severity == 'LOW':
                            summary['low'] += 1
                            summary['trivy_low'] += 1
        except Exception as e:
            print(f"Error reading Trivy report: {e}")
        
        # Analyze Gitleaks report (secrets)
        if gitleaks_path:
            try:
                if os.path.exists(gitleaks_path):
                    with open(gitleaks_path, 'r') as f:
                        gitleaks_data = json.load(f)
                    secrets = gitleaks_data.get('results', [])
                    summary['secrets_found'] = len(secrets)
                    for secret in secrets:
                        sev = secret.get('severity', 'MEDIUM').upper()
                        if sev == 'CRITICAL':
                            summary['secrets_critical'] += 1
                            summary['critical'] += 1
                        elif sev == 'HIGH':
                            summary['secrets_high'] += 1
                            summary['high'] += 1
                        else:
                            summary['secrets_medium'] += 1
                            summary['medium'] += 1
            except Exception as e:
                print(f"Error reading Gitleaks report: {e}")
        
        # Analyze DAST report (ZAP)
        if dast_path:
            try:
                if os.path.exists(dast_path):
                    with open(dast_path, 'r') as f:
                        dast_data = json.load(f)
                    dast_alerts = dast_data.get('results', [])
                    summary['dast_alerts'] = len(dast_alerts)
                    for alert in dast_alerts:
                        risk = alert.get('risk', 'LOW').upper()
                        if risk == 'HIGH':
                            summary['dast_high'] += 1
                            summary['high'] += 1
                        elif risk == 'MEDIUM':
                            summary['dast_medium'] += 1
                            summary['medium'] += 1
                        elif risk == 'LOW':
                            summary['dast_low'] += 1
                            summary['low'] += 1
            except Exception as e:
                print(f"Error reading DAST report: {e}")
        
        summary['total'] = summary['critical'] + summary['high'] + summary['medium'] + summary['low']
        
        # Calculate security score with SEPARATED weights for code vs image vulns
        # Code vulnerabilities (SAST) — full weight
        code_high_impact = min(25, summary['sast_high'] * 8)
        code_medium_impact = min(10, summary['sast_medium'] * 3)
        code_low_impact = min(5, summary['sast_low'] * 1)
        
        # Image/dependency vulnerabilities (Trivy) — reduced weight (~50%)
        image_critical_impact = min(25, summary['trivy_critical'] * 10)
        image_high_impact = min(15, summary['trivy_high'] * 3)
        image_medium_impact = min(8, summary['trivy_medium'] * 1)
        image_low_impact = min(2, int(summary['trivy_low'] * 0.5))
        
        # Secrets (Gitleaks) — critical weight (secrets are severe)
        secrets_critical_impact = min(30, summary['secrets_critical'] * 12)
        secrets_high_impact = min(20, summary['secrets_high'] * 8)
        secrets_medium_impact = min(10, summary['secrets_medium'] * 4)
        
        # DAST findings — moderate weight
        dast_high_impact = min(20, summary['dast_high'] * 6)
        dast_medium_impact = min(10, summary['dast_medium'] * 2)
        dast_low_impact = min(3, summary['dast_low'] * 1)
        
        total_penalty = (code_high_impact + code_medium_impact + code_low_impact +
                         image_critical_impact + image_high_impact + image_medium_impact + image_low_impact +
                         secrets_critical_impact + secrets_high_impact + secrets_medium_impact +
                         dast_high_impact + dast_medium_impact + dast_low_impact)
        
        score = 100 - total_penalty
        summary['security_score'] = max(0, min(100, int(score)))
        
        return summary
    
    def _load_policy(self) -> Dict[str, Any]:
        """Load policy settings from dashboard config"""
        default_policy = {
            "minScore": 70,
            "blockCritical": True,
            "blockHigh": False,
            "maxCriticalVulns": 0,
            "maxHighVulns": 5,
            "autoBlock": True
        }
        policy_path = Path(self.reports_dir).parent.parent / "dashboard" / "data" / "policy.json"
        try:
            if policy_path.exists():
                with open(policy_path) as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading policy: {e}")
        return default_policy
    
    def _evaluate_deployment(self, score: int, summary: Dict[str, Any]) -> bool:
        """Evaluate if deployment should be allowed based on policy settings"""
        policy = self._load_policy()
        
        # If auto-blocking is disabled, always allow
        if not policy.get("autoBlock", True):
            return True
        
        # Check minimum score
        min_score = policy.get("minScore", 70)
        if score < min_score:
            return False
        
        # Check critical vulnerabilities (only if policy says to block)
        if policy.get("blockCritical", True):
            max_critical = policy.get("maxCriticalVulns", 0)
            if summary.get('critical', 0) > max_critical:
                return False
        
        # Check high vulnerabilities (only if policy says to block)
        if policy.get("blockHigh", False):
            max_high = policy.get("maxHighVulns", 5)
            if summary.get('high', 0) > max_high:
                return False
        
        # Block on secrets if policy says so (default: block)
        if policy.get("blockOnSecrets", True):
            if summary.get('secrets_found', 0) > 0:
                return False
        
        # Block on DAST high findings if policy says so (default: don't block)
        if policy.get("blockOnDastHigh", False):
            if summary.get('dast_high', 0) > 0:
                return False
        
        return True
    
    def _generate_decision_report(self, pipeline: PipelineRun):
        """Generate security decision JSON report"""
        policy = self._load_policy()
        min_score = policy.get("minScore", 70)
        
        decision_report = {
            "pipeline_id": pipeline.id,
            "timestamp": datetime.now().isoformat(),
            "repository": pipeline.repo_name,
            "branch": pipeline.branch,
            "commit": pipeline.commit_sha,
            "security_score": pipeline.security_score,
            "is_deployable": pipeline.is_deployable,
            "vulnerability_summary": pipeline.vulnerability_summary,
            "decision": "APPROVED" if pipeline.is_deployable else "BLOCKED",
            "reasons": []
        }
        
        if not pipeline.is_deployable:
            if pipeline.security_score < min_score:
                decision_report["reasons"].append(f"Security score ({pipeline.security_score}) below threshold ({min_score})")
            if policy.get("blockCritical", True) and pipeline.vulnerability_summary.get('critical', 0) > policy.get("maxCriticalVulns", 0):
                decision_report["reasons"].append(f"Critical vulnerabilities found: {pipeline.vulnerability_summary['critical']}")
            if policy.get("blockHigh", False) and pipeline.vulnerability_summary.get('high', 0) > policy.get("maxHighVulns", 5):
                decision_report["reasons"].append(f"Too many high vulnerabilities: {pipeline.vulnerability_summary['high']}")
        
        decision_path = os.path.join(self.reports_dir, "security_decision.json")
        with open(decision_path, 'w') as f:
            json.dump(decision_report, f, indent=2)
    
    def get_pipeline(self, pipeline_id: str) -> Optional[Dict]:
        """Get a specific pipeline run"""
        if pipeline_id in self.current_runs:
            return self.current_runs[pipeline_id].to_dict()
        for p in self.pipeline_history:
            if p['id'] == pipeline_id:
                return p
        return None
    
    def get_pipelines(self, limit: int = 20) -> list:
        """Get recent pipeline runs"""
        return self.pipeline_history[:limit]
    
    def get_latest_pipeline(self) -> Optional[Dict]:
        """Get the most recent pipeline run"""
        if self.pipeline_history:
            return self.pipeline_history[0]
        return None


def run_pipeline_async(executor: PipelineExecutor, pipeline: PipelineRun, 
                       repo_url: str = None, target_dir: str = None, image_name: str = None):
    """Run pipeline in a background thread"""
    thread = threading.Thread(
        target=executor.run_pipeline,
        args=(pipeline, repo_url, target_dir, image_name)
    )
    thread.daemon = True
    thread.start()
    return thread

# =============================================================================
# STANDALONE PIPELINE FUNCTIONS FOR EXTERNAL REPO SCANNING
# =============================================================================

class PipelineError(Exception):
    """Custom exception for pipeline errors"""
    def __init__(self, message: str, stage: str = None, details: str = None):
        self.message = message
        self.stage = stage
        self.details = details
        super().__init__(self.message)


class PipelineResult:
    """Result object for pipeline execution"""
    def __init__(self):
        self.success: bool = False
        self.pipeline_id: str = ""
        self.repo_url: str = ""
        self.branch: str = ""
        self.security_score: int = 0
        self.is_deployable: bool = False
        self.stages: Dict[str, Dict] = {}
        self.error: Optional[str] = None
        self.bandit_report_path: Optional[str] = None
        self.trivy_report_path: Optional[str] = None
        self.decision_report_path: Optional[str] = None
        self.started_at: str = ""
        self.finished_at: str = ""
        self.duration_seconds: float = 0
        self.vulnerability_summary: Dict[str, Any] = {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "pipeline_id": self.pipeline_id,
            "repo_url": self.repo_url,
            "branch": self.branch,
            "security_score": self.security_score,
            "is_deployable": self.is_deployable,
            "stages": self.stages,
            "error": self.error,
            "reports": {
                "bandit": self.bandit_report_path,
                "trivy": self.trivy_report_path,
                "decision": self.decision_report_path
            },
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_seconds": self.duration_seconds,
            "vulnerability_summary": self.vulnerability_summary
        }


def validate_repo_url(repo_url: str) -> Tuple[bool, str]:
    """
    Validate GitHub repository URL format.
    
    Args:
        repo_url: The repository URL to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not repo_url:
        return False, "Repository URL is required"
    
    # Check for valid GitHub URL patterns
    github_patterns = [
        r'^https://github\.com/[\w\-\.]+/[\w\-\.]+(?:\.git)?$',
        r'^git@github\.com:[\w\-\.]+/[\w\-\.]+(?:\.git)?$',
        r'^https://[\w\-\.]+/[\w\-\.]+/[\w\-\.]+(?:\.git)?$',  # Generic git hosting
    ]
    
    for pattern in github_patterns:
        if re.match(pattern, repo_url):
            return True, ""
    
    return False, f"Invalid repository URL format: {repo_url}"


def create_temp_workspace() -> str:
    """
    Create a temporary workspace directory for cloning and scanning.
    
    Returns:
        Path to the created workspace directory
    """
    workspace_id = str(uuid.uuid4())[:8]
    workspace_path = f"/tmp/{WORKSPACE_PREFIX}{workspace_id}"
    
    logger.info(f"Creating workspace: {workspace_path}")
    os.makedirs(workspace_path, exist_ok=True)
    
    return workspace_path


def cleanup_workspace(workspace_path: str) -> None:
    """
    Safely delete the temporary workspace directory.
    
    Args:
        workspace_path: Path to the workspace to clean up
    """
    if not workspace_path:
        return
    
    # Safety check: only delete directories in /tmp with our prefix
    if not workspace_path.startswith("/tmp/") or WORKSPACE_PREFIX not in workspace_path:
        logger.warning(f"Refusing to delete suspicious path: {workspace_path}")
        return
    
    try:
        if os.path.exists(workspace_path):
            shutil.rmtree(workspace_path)
            logger.info(f"Cleaned up workspace: {workspace_path}")
    except Exception as e:
        logger.error(f"Failed to cleanup workspace {workspace_path}: {e}")


def clone_repository(repo_url: str, branch: str, workspace_path: str) -> Tuple[bool, str]:
    """
    Clone a Git repository to the workspace.
    
    Args:
        repo_url: URL of the repository to clone
        branch: Branch to clone
        workspace_path: Directory to clone into
        
    Returns:
        Tuple of (success, message/error)
    """
    logger.info(f"Cloning repository: {repo_url} (branch: {branch})")
    
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", branch, repo_url, workspace_path],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode != 0:
            error_msg = result.stderr.strip() or "Unknown git clone error"
            
            # Check for common errors
            if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                return False, f"Repository not found or branch '{branch}' does not exist"
            if "authentication" in error_msg.lower() or "permission denied" in error_msg.lower():
                return False, "Authentication failed - repository may be private"
            
            return False, f"Git clone failed: {error_msg}"
        
        logger.info(f"Successfully cloned repository to {workspace_path}")
        return True, "Repository cloned successfully"
        
    except subprocess.TimeoutExpired:
        return False, "Git clone timed out (>120s) - repository may be too large"
    except FileNotFoundError:
        return False, "Git is not installed on the system"
    except Exception as e:
        return False, f"Unexpected error during git clone: {str(e)}"


def run_multi_sast_scan(
    repo_path: str,
    reports_dir: str = None,
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Run multi-language SAST scan on the repository.
    
    Uses the sast_scanner module to auto-detect languages and run
    appropriate SAST tools (Bandit, Semgrep, Gosec, Flawfinder, ShellCheck).
    
    Args:
        repo_path: Path to the repository to scan
        reports_dir: Directory to save reports (defaults to runtime/reports/)
        
    Returns:
        Tuple of (success, message, scan_results)
    """
    if reports_dir is None:
        reports_dir = str(REPORTS_DIR)
    
    logger.info(f"Running multi-language SAST scan on: {repo_path}")
    logger.info(f"Reports will be saved to: {reports_dir}")
    
    try:
        sast_report = run_sast_scan(repo_path, reports_dir)
        
        total_issues = sast_report.get('metrics', {}).get('totals', {}).get('total', 0)
        langs = list(sast_report.get('languages_detected', {}).keys())
        tools = [t for t, info in sast_report.get('tools_used', {}).items() if info.get('success')]
        
        msg = f"SAST scan completed: {total_issues} issues across {len(langs)} language(s) using {', '.join(tools) or 'no tools available'}"
        logger.info(msg)
        
        return True, msg, sast_report
        
    except Exception as e:
        return False, f"SAST scan failed: {str(e)}", {}


# Backward compatibility alias
def run_bandit_scan(
    repo_path: str,
    output_path: str = None
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Backward-compatible wrapper: runs multi-language SAST scan
    and returns results in bandit-compatible format.
    """
    reports_dir = os.path.dirname(output_path) if output_path else str(REPORTS_DIR)
    success, message, sast_report = run_multi_sast_scan(repo_path, reports_dir)
    
    # Return the bandit-compatible report for backward compat
    bandit_path = os.path.join(reports_dir, "bandit-report.json")
    bandit_results = {}
    if os.path.exists(bandit_path):
        try:
            with open(bandit_path, 'r') as f:
                bandit_results = json.load(f)
        except Exception:
            pass
    
    return success, message, bandit_results


def run_trivy_scan(
    target: str,
    output_path: str = None,
    scan_type: str = "fs"
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Run Trivy vulnerability scan.
    
    Args:
        target: Path to scan (filesystem) or image name (container)
        output_path: Path to save the JSON report
        scan_type: Type of scan - "fs" for filesystem, "image" for container
        
    Returns:
        Tuple of (success, message, scan_results)
    """
    if output_path is None:
        output_path = str(DEFAULT_TRIVY_REPORT)
    
    logger.info(f"Running Trivy {scan_type} scan on: {target}")
    logger.info(f"Report will be saved to: {output_path}")
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        cmd = [
            "trivy",
            scan_type,
            "--format", "json",
            "--output", output_path,
            target
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600
        )
        
        if result.returncode != 0:
            error_msg = result.stderr.strip() or "Unknown Trivy error"
            # Check if it's just "no vulnerabilities found" type message
            if "no vulnerabilities" in error_msg.lower():
                return True, "No vulnerabilities found", {}
            return False, f"Trivy scan failed: {error_msg}", {}
        
        # Load and return results
        scan_results = {}
        if os.path.exists(output_path):
            with open(output_path, 'r') as f:
                scan_results = json.load(f)
        
        logger.info("Trivy scan completed successfully")
        return True, "Trivy scan completed", scan_results
        
    except subprocess.TimeoutExpired:
        return False, "Trivy scan timed out (>600s)", {}
    except FileNotFoundError:
        return False, "Trivy is not installed", {}
    except json.JSONDecodeError:
        return False, "Failed to parse Trivy output", {}
    except Exception as e:
        return False, f"Unexpected error during Trivy scan: {str(e)}", {}


def analyze_scan_results(
    bandit_results: Dict[str, Any],
    trivy_results: Dict[str, Any],
    sast_report: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Analyze scan results and calculate security metrics.
    
    Supports both the new unified SAST report and legacy Bandit-only results.
    Separates code vulnerabilities (SAST) from image/dependency vulnerabilities
    (Trivy) and applies different weights.
    
    Args:
        bandit_results: Bandit/legacy scan results (backward compat)
        trivy_results: Trivy scan results
        sast_report: Unified SAST report (preferred when available)
        
    Returns:
        Dictionary with vulnerability summary and security score
    """
    summary = {
        'critical': 0,
        'high': 0,
        'medium': 0,
        'low': 0,
        'total': 0,
        'sast_issues': 0,
        'bandit_issues': 0,
        'trivy_vulns': 0,
        'security_score': 100,
        'sast_high': 0,
        'sast_medium': 0,
        'sast_low': 0,
        'bandit_high': 0,
        'bandit_medium': 0,
        'bandit_low': 0,
        'trivy_critical': 0,
        'trivy_high': 0,
        'trivy_medium': 0,
        'trivy_low': 0,
        'languages_detected': [],
        'tools_used': [],
    }
    
    # Prefer unified SAST report when available
    if sast_report and sast_report.get('metrics'):
        metrics = sast_report.get('metrics', {}).get('totals', {})
        summary['sast_issues'] = metrics.get('total', 0)
        summary['sast_high'] = metrics.get('high', 0)
        summary['sast_medium'] = metrics.get('medium', 0)
        summary['sast_low'] = metrics.get('low', 0)
        summary['bandit_issues'] = summary['sast_issues']
        summary['bandit_high'] = summary['sast_high']
        summary['bandit_medium'] = summary['sast_medium']
        summary['bandit_low'] = summary['sast_low']
        summary['high'] += summary['sast_high']
        summary['medium'] += summary['sast_medium']
        summary['low'] += summary['sast_low']
        summary['languages_detected'] = list(sast_report.get('languages_detected', {}).keys())
        summary['tools_used'] = [t for t, info in sast_report.get('tools_used', {}).items() if info.get('success')]
    elif bandit_results:
        # Fallback to bandit-only results
        results = bandit_results.get('results', [])
        summary['bandit_issues'] = len(results)
        summary['sast_issues'] = len(results)
        
        for issue in results:
            severity = issue.get('issue_severity', '').upper()
            if severity == 'HIGH':
                summary['high'] += 1
                summary['sast_high'] += 1
                summary['bandit_high'] += 1
            elif severity == 'MEDIUM':
                summary['medium'] += 1
                summary['sast_medium'] += 1
                summary['bandit_medium'] += 1
            elif severity == 'LOW':
                summary['low'] += 1
                summary['sast_low'] += 1
                summary['bandit_low'] += 1
    
    # Analyze Trivy results (image/dependency vulnerabilities)
    if trivy_results:
        for result in trivy_results.get('Results', []):
            vulns = result.get('Vulnerabilities', []) or []
            summary['trivy_vulns'] += len(vulns)
            
            for vuln in vulns:
                severity = vuln.get('Severity', '').upper()
                if severity == 'CRITICAL':
                    summary['critical'] += 1
                    summary['trivy_critical'] += 1
                elif severity == 'HIGH':
                    summary['high'] += 1
                    summary['trivy_high'] += 1
                elif severity == 'MEDIUM':
                    summary['medium'] += 1
                    summary['trivy_medium'] += 1
                elif severity == 'LOW':
                    summary['low'] += 1
                    summary['trivy_low'] += 1
    
    summary['total'] = (
        summary['critical'] + summary['high'] + 
        summary['medium'] + summary['low']
    )
    
    # Calculate security score with SEPARATED weights for code vs image vulns
    code_high_impact = min(25, summary['sast_high'] * 8)
    code_medium_impact = min(10, summary['sast_medium'] * 3)
    code_low_impact = min(5, summary['sast_low'] * 1)
    
    image_critical_impact = min(25, summary['trivy_critical'] * 10)
    image_high_impact = min(15, summary['trivy_high'] * 3)
    image_medium_impact = min(8, summary['trivy_medium'] * 1)
    image_low_impact = min(2, int(summary['trivy_low'] * 0.5))
    
    total_penalty = (code_high_impact + code_medium_impact + code_low_impact +
                     image_critical_impact + image_high_impact + image_medium_impact + image_low_impact)
    
    score = 100 - total_penalty
    summary['security_score'] = max(0, min(100, int(score)))

    
    return summary


def call_decision_engine(reports_dir: str = None) -> Dict[str, Any]:
    """
    Call the security decision engine to evaluate scan results.
    
    Args:
        reports_dir: Directory containing the scan reports
        
    Returns:
        Decision result dictionary
    """
    if reports_dir is None:
        reports_dir = str(REPORTS_DIR)
    
    logger.info("Calling security decision engine")
    
    try:
        # Import and run the decision engine
        decision_engine_path = BASE_DIR / "security_decision_engine.py"
        
        if decision_engine_path.exists():
            result = subprocess.run(
                [sys.executable, str(decision_engine_path)],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(BASE_DIR)
            )
            
            # The decision engine exits with 1 if deployment is blocked
            # This is expected behavior, not an error
            logger.info("Decision engine completed")
            
            # Load the decision report
            decision_path = Path(reports_dir) / "security_decision.json"
            if decision_path.exists():
                with open(decision_path, 'r') as f:
                    return json.load(f)
        else:
            logger.warning(f"Decision engine not found at {decision_engine_path}")
            
    except Exception as e:
        logger.error(f"Error calling decision engine: {e}")
    
    return {}


def clear_old_reports(clear_trivy: bool = True) -> None:
    """
    Clear old reports before starting a new scan.
    
    Args:
        clear_trivy: Whether to clear the Trivy report (default: True)
    """
    try:
        # Clear Bandit report
        if DEFAULT_BANDIT_REPORT.exists():
            DEFAULT_BANDIT_REPORT.unlink()
            logger.info("Cleared old Bandit report")
        
        # Clear unified SAST report
        if DEFAULT_SAST_REPORT.exists():
            DEFAULT_SAST_REPORT.unlink()
            logger.info("Cleared old SAST report")
        
        # Clear any tool-specific reports (semgrep, gosec, etc.)
        for report_name in ["semgrep-report.json", "gosec-report.json", 
                           "flawfinder-report.json", "shellcheck-report.json"]:
            report_path = REPORTS_DIR / report_name
            if report_path.exists():
                report_path.unlink()
        
        # Clear Trivy report if requested
        if clear_trivy and DEFAULT_TRIVY_REPORT.exists():
            DEFAULT_TRIVY_REPORT.unlink()
            logger.info("Cleared old Trivy report")
        
        # Clear Gitleaks report
        if DEFAULT_GITLEAKS_REPORT.exists():
            DEFAULT_GITLEAKS_REPORT.unlink()
            logger.info("Cleared old Gitleaks report")
        
        # Clear DAST report
        if DEFAULT_DAST_REPORT.exists():
            DEFAULT_DAST_REPORT.unlink()
            logger.info("Cleared old DAST report")
        
        # Clear decision report
        if DEFAULT_DECISION_REPORT.exists():
            DEFAULT_DECISION_REPORT.unlink()
            logger.info("Cleared old decision report")
            
    except Exception as e:
        logger.warning(f"Error clearing old reports: {e}")


def run_pipeline(
    repo_url: str,
    branch: str = "main",
    run_trivy: bool = False,
    trivy_target: str = None
) -> PipelineResult:
    """
    Run the complete security scanning pipeline on an external repository.
    
    This is the main entry point for scanning external GitHub repositories.
    
    Args:
        repo_url: URL of the Git repository to scan
        branch: Branch to scan (default: "main")
        run_trivy: Whether to run Trivy scan (default: False)
        trivy_target: Target for Trivy scan (filesystem path or image name)
        
    Returns:
        PipelineResult object with all scan results and metadata
        
    Example:
        >>> result = run_pipeline(
        ...     repo_url="https://github.com/user/repo",
        ...     branch="main"
        ... )
        >>> if result.success:
        ...     print(f"Security Score: {result.security_score}")
        ... else:
        ...     print(f"Error: {result.error}")
    """
    result = PipelineResult()
    result.pipeline_id = str(uuid.uuid4())[:8]
    result.repo_url = repo_url
    result.branch = branch
    result.started_at = datetime.now().isoformat()
    
    workspace_path = None
    
    logger.info("=" * 60)
    logger.info(f"Starting SentinelOps Pipeline: {result.pipeline_id}")
    logger.info(f"Repository: {repo_url}")
    logger.info(f"Branch: {branch}")
    logger.info("=" * 60)
    
    # Clear old reports before starting new scan
    clear_old_reports(clear_trivy=True)
    
    try:
        # =================================================================
        # STEP 1: Validate repository URL
        # =================================================================
        result.stages['validate'] = {
            'name': 'Validate Input',
            'status': 'running',
            'started_at': datetime.now().isoformat()
        }
        
        is_valid, error_msg = validate_repo_url(repo_url)
        if not is_valid:
            result.stages['validate']['status'] = 'failed'
            result.stages['validate']['error'] = error_msg
            raise PipelineError(error_msg, stage='validate')
        
        result.stages['validate']['status'] = 'success'
        result.stages['validate']['finished_at'] = datetime.now().isoformat()
        logger.info("✓ Repository URL validated")
        
        # =================================================================
        # STEP 2: Create temporary workspace
        # =================================================================
        result.stages['workspace'] = {
            'name': 'Create Workspace',
            'status': 'running',
            'started_at': datetime.now().isoformat()
        }
        
        workspace_path = create_temp_workspace()
        # Remove the workspace dir so git clone can create it
        shutil.rmtree(workspace_path, ignore_errors=True)
        
        result.stages['workspace']['status'] = 'success'
        result.stages['workspace']['path'] = workspace_path
        result.stages['workspace']['finished_at'] = datetime.now().isoformat()
        logger.info(f"✓ Workspace created: {workspace_path}")
        
        # =================================================================
        # STEP 3: Clone repository
        # =================================================================
        result.stages['clone'] = {
            'name': 'Clone Repository',
            'status': 'running',
            'started_at': datetime.now().isoformat()
        }
        
        success, message = clone_repository(repo_url, branch, workspace_path)
        if not success:
            result.stages['clone']['status'] = 'failed'
            result.stages['clone']['error'] = message
            raise PipelineError(message, stage='clone')
        
        result.stages['clone']['status'] = 'success'
        result.stages['clone']['message'] = message
        result.stages['clone']['finished_at'] = datetime.now().isoformat()
        logger.info(f"✓ {message}")
        
        # =================================================================
        # STEP 4: Run Multi-Language SAST scan
        # =================================================================
        result.stages['sast'] = {
            'name': 'Multi-Language SAST Scan',
            'status': 'running',
            'started_at': datetime.now().isoformat()
        }
        
        reports_dir = str(REPORTS_DIR)
        success, message, sast_report = run_multi_sast_scan(workspace_path, reports_dir)
        
        if not success:
            result.stages['sast']['status'] = 'failed'
            result.stages['sast']['error'] = message
            raise PipelineError(message, stage='sast')
        
        sast_metrics = sast_report.get('metrics', {}).get('totals', {})
        result.stages['sast']['status'] = 'success'
        result.stages['sast']['message'] = message
        result.stages['sast']['issues_found'] = sast_metrics.get('total', 0)
        result.stages['sast']['languages'] = list(sast_report.get('languages_detected', {}).keys())
        result.stages['sast']['tools'] = [t for t, info in sast_report.get('tools_used', {}).items() if info.get('success')]
        result.stages['sast']['finished_at'] = datetime.now().isoformat()
        result.bandit_report_path = str(REPORTS_DIR / "sast-report.json")
        # Also keep backward compat bandit results reference
        bandit_results = {}
        bandit_path = str(DEFAULT_BANDIT_REPORT)
        if os.path.exists(bandit_path):
            try:
                with open(bandit_path, 'r') as f:
                    bandit_results = json.load(f)
            except Exception:
                pass
        logger.info(f"✓ {message}")
        
        # =================================================================
        # STEP 4.5: Run Gitleaks secret detection
        # =================================================================
        result.stages['gitleaks'] = {
            'name': 'Secret Detection (Gitleaks)',
            'status': 'running',
            'started_at': datetime.now().isoformat()
        }
        
        try:
            gitleaks_report = run_secrets_scan(workspace_path, str(REPORTS_DIR))
            secrets_count = gitleaks_report.get('total_secrets', 0)
            tool_used = gitleaks_report.get('tool', 'unknown')
            result.stages['gitleaks']['status'] = 'success'
            result.stages['gitleaks']['message'] = f"Secret scan ({tool_used}): {secrets_count} secret(s) found"
            result.stages['gitleaks']['secrets_found'] = secrets_count
            result.stages['gitleaks']['finished_at'] = datetime.now().isoformat()
            logger.info(f"✓ Gitleaks: {secrets_count} secret(s) found")
        except Exception as e:
            result.stages['gitleaks']['status'] = 'failed'
            result.stages['gitleaks']['error'] = str(e)
            result.stages['gitleaks']['finished_at'] = datetime.now().isoformat()
            logger.warning(f"⚠ Gitleaks scan failed: {e}")
            gitleaks_report = {}
        
        # =================================================================
        # STEP 5: Run Trivy scan (optional)
        # =================================================================
        trivy_results = {}
        if run_trivy:
            result.stages['trivy'] = {
                'name': 'Trivy Vulnerability Scan',
                'status': 'running',
                'started_at': datetime.now().isoformat()
            }
            
            scan_target = trivy_target or workspace_path
            scan_type = "image" if trivy_target and not os.path.isdir(trivy_target) else "fs"
            trivy_output = str(DEFAULT_TRIVY_REPORT)
            
            success, message, trivy_results = run_trivy_scan(
                scan_target, trivy_output, scan_type
            )
            
            if not success:
                result.stages['trivy']['status'] = 'failed'
                result.stages['trivy']['error'] = message
                # Don't fail the entire pipeline for Trivy errors
                logger.warning(f"⚠ Trivy scan failed: {message}")
            else:
                result.stages['trivy']['status'] = 'success'
                result.stages['trivy']['message'] = message
                result.stages['trivy']['finished_at'] = datetime.now().isoformat()
                result.trivy_report_path = trivy_output
                logger.info(f"✓ {message}")
        else:
            result.stages['trivy'] = {
                'name': 'Trivy Vulnerability Scan',
                'status': 'skipped',
                'message': 'Trivy scan not requested'
            }
        
        # =================================================================
        # STEP 5.5: Run DAST scan (if we have a container image)
        # =================================================================
        dast_report = {}
        if run_trivy and trivy_target and not os.path.isdir(trivy_target or ''):
            # trivy_target is a Docker image — we can run DAST against it
            result.stages['dast'] = {
                'name': 'DAST Security Scan (ZAP)',
                'status': 'running',
                'started_at': datetime.now().isoformat()
            }
            try:
                dockerfile_path = os.path.join(workspace_path, 'Dockerfile') if workspace_path else None
                dast_report = run_dast_scan(
                    target_url=None,
                    reports_dir=str(REPORTS_DIR),
                    scan_type='baseline',
                    image_name=trivy_target,
                    dockerfile_path=dockerfile_path if dockerfile_path and os.path.exists(dockerfile_path) else None,
                )
                dast_alerts = dast_report.get('total_alerts', 0)
                result.stages['dast']['status'] = 'success'
                result.stages['dast']['message'] = f"DAST scan completed: {dast_alerts} alert(s) found"
                result.stages['dast']['alerts_found'] = dast_alerts
                result.stages['dast']['finished_at'] = datetime.now().isoformat()
                logger.info(f"✓ DAST: {dast_alerts} alert(s) found")
            except Exception as e:
                result.stages['dast']['status'] = 'failed'
                result.stages['dast']['error'] = str(e)
                result.stages['dast']['finished_at'] = datetime.now().isoformat()
                logger.warning(f"⚠ DAST scan failed: {e}")
        else:
            result.stages['dast'] = {
                'name': 'DAST Security Scan (ZAP)',
                'status': 'skipped',
                'message': 'No Docker image target — DAST scan requires a running application'
            }
        
        # =================================================================
        # STEP 6: Analyze results
        # =================================================================
        result.stages['analysis'] = {
            'name': 'Security Analysis',
            'status': 'running',
            'started_at': datetime.now().isoformat()
        }
        
        vuln_summary = analyze_scan_results(bandit_results, trivy_results, sast_report=sast_report)
        result.vulnerability_summary = vuln_summary
        result.security_score = vuln_summary['security_score']
        
        result.stages['analysis']['status'] = 'success'
        result.stages['analysis']['security_score'] = result.security_score
        result.stages['analysis']['finished_at'] = datetime.now().isoformat()
        logger.info(f"✓ Security analysis complete - Score: {result.security_score}/100")
        
        # =================================================================
        # STEP 7: Call decision engine
        # =================================================================
        result.stages['decision'] = {
            'name': 'Security Decision',
            'status': 'running',
            'started_at': datetime.now().isoformat()
        }
        
        decision = call_decision_engine()
        result.is_deployable = decision.get('deployment_allowed', result.security_score >= 70)
        result.decision_report_path = str(DEFAULT_DECISION_REPORT)
        
        result.stages['decision']['status'] = 'success'
        result.stages['decision']['deployment_allowed'] = result.is_deployable
        result.stages['decision']['finished_at'] = datetime.now().isoformat()
        
        decision_emoji = "✅" if result.is_deployable else "❌"
        decision_text = "APPROVED" if result.is_deployable else "BLOCKED"
        logger.info(f"{decision_emoji} Decision: {decision_text}")
        
        # Pipeline completed successfully
        result.success = True
        
    except PipelineError as e:
        result.success = False
        result.error = e.message
        logger.error(f"Pipeline failed at stage '{e.stage}': {e.message}")
        
    except Exception as e:
        result.success = False
        result.error = str(e)
        logger.error(f"Unexpected pipeline error: {e}")
        
    finally:
        # =================================================================
        # STEP 8: Cleanup workspace
        # =================================================================
        result.finished_at = datetime.now().isoformat()
        
        if result.started_at:
            start = datetime.fromisoformat(result.started_at)
            end = datetime.fromisoformat(result.finished_at)
            result.duration_seconds = (end - start).total_seconds()
        
        if workspace_path:
            cleanup_workspace(workspace_path)
        
        logger.info("=" * 60)
        logger.info(f"Pipeline {result.pipeline_id} completed")
        logger.info(f"Success: {result.success}")
        logger.info(f"Duration: {result.duration_seconds:.2f}s")
        logger.info("=" * 60)
    
    return result


def run_pipeline_background(
    repo_url: str,
    branch: str = "main",
    run_trivy: bool = False,
    trivy_target: str = None,
    callback: callable = None
) -> str:
    """
    Run the pipeline in a background thread.
    
    Args:
        repo_url: URL of the Git repository to scan
        branch: Branch to scan
        run_trivy: Whether to run Trivy scan
        trivy_target: Target for Trivy scan
        callback: Optional callback function(result: PipelineResult)
        
    Returns:
        Pipeline ID
    """
    pipeline_id = str(uuid.uuid4())[:8]
    
    def run():
        result = run_pipeline(repo_url, branch, run_trivy, trivy_target)
        result.pipeline_id = pipeline_id
        if callback:
            callback(result)
    
    thread = threading.Thread(target=run)
    thread.daemon = True
    thread.start()
    
    return pipeline_id
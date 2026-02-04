#!/usr/bin/env python3
"""
Pipeline Executor Service for SentinelOps
Handles automated security scanning triggered by GitHub webhooks
"""

import os
import json
import subprocess
import shutil
import tempfile
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import threading
import uuid

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
                "bandit_scan": {"name": "Bandit Security Scan", "status": StageStatus.PENDING.value},
                "trivy_scan": {"name": "Trivy Container Scan", "status": StageStatus.PENDING.value},
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
            
            if os.path.exists(dockerfile_path):
                try:
                    build_image = image_name or f"sentinelops-scan-{pipeline.id}"
                    result = subprocess.run(
                        ["docker", "build", "-t", build_image, work_dir],
                        capture_output=True, text=True, timeout=300
                    )
                    if result.returncode != 0:
                        raise Exception(result.stderr)
                    self.update_stage(pipeline.id, "build", StageStatus.SUCCESS,
                                    f"Built image: {build_image}")
                except Exception as e:
                    self.update_stage(pipeline.id, "build", StageStatus.FAILED, error=str(e))
                    raise
            else:
                image_name = image_name or "python:3.11-slim"
                self.update_stage(pipeline.id, "build", StageStatus.SKIPPED, 
                                "No Dockerfile found, using base image for scan")
            
            # Stage 3: Bandit Security Scan
            self.update_stage(pipeline.id, "bandit_scan", StageStatus.RUNNING)
            bandit_report_path = os.path.join(self.reports_dir, "bandit-report.json")
            try:
                result = subprocess.run(
                    ["bandit", "-r", work_dir, "-f", "json", "-o", bandit_report_path, 
                     "--exclude", ".git,node_modules,venv,__pycache__"],
                    capture_output=True, text=True, timeout=180
                )
                # Bandit returns 1 if issues found, which is okay
                if result.returncode not in [0, 1]:
                    raise Exception(result.stderr)
                self.update_stage(pipeline.id, "bandit_scan", StageStatus.SUCCESS,
                                "Bandit scan completed")
            except FileNotFoundError:
                self.update_stage(pipeline.id, "bandit_scan", StageStatus.FAILED, 
                                error="Bandit not installed")
                raise Exception("Bandit not installed")
            except Exception as e:
                self.update_stage(pipeline.id, "bandit_scan", StageStatus.FAILED, error=str(e))
                raise
            
            # Stage 4: Trivy Container Scan
            self.update_stage(pipeline.id, "trivy_scan", StageStatus.RUNNING)
            trivy_report_path = os.path.join(self.reports_dir, "trivy-report.json")
            scan_target = image_name or f"sentinelops-scan-{pipeline.id}"
            
            try:
                result = subprocess.run(
                    ["trivy", "image", "--format", "json", "--output", trivy_report_path, scan_target],
                    capture_output=True, text=True, timeout=300
                )
                if result.returncode != 0 and "No such image" not in result.stderr:
                    raise Exception(result.stderr)
                self.update_stage(pipeline.id, "trivy_scan", StageStatus.SUCCESS,
                                f"Trivy scan completed for {scan_target}")
            except FileNotFoundError:
                self.update_stage(pipeline.id, "trivy_scan", StageStatus.FAILED,
                                error="Trivy not installed")
                raise Exception("Trivy not installed")
            except Exception as e:
                self.update_stage(pipeline.id, "trivy_scan", StageStatus.FAILED, error=str(e))
                raise
            
            # Stage 5: Policy Evaluation
            self.update_stage(pipeline.id, "policy_check", StageStatus.RUNNING)
            try:
                vuln_summary = self._analyze_vulnerabilities(bandit_report_path, trivy_report_path)
                pipeline.vulnerability_summary = vuln_summary
                pipeline.security_score = vuln_summary.get('security_score', 0)
                self.update_stage(pipeline.id, "policy_check", StageStatus.SUCCESS,
                                f"Security Score: {pipeline.security_score}/100")
            except Exception as e:
                self.update_stage(pipeline.id, "policy_check", StageStatus.FAILED, error=str(e))
                raise
            
            # Stage 6: Deployment Decision
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
    
    def _analyze_vulnerabilities(self, bandit_path: str, trivy_path: str) -> Dict[str, Any]:
        """Analyze vulnerability reports and calculate security score"""
        summary = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
            'total': 0,
            'bandit_issues': 0,
            'trivy_vulns': 0,
            'security_score': 100
        }
        
        # Analyze Bandit report
        try:
            with open(bandit_path, 'r') as f:
                bandit_data = json.load(f)
                results = bandit_data.get('results', [])
                summary['bandit_issues'] = len(results)
                
                for issue in results:
                    severity = issue.get('issue_severity', '').upper()
                    if severity == 'HIGH':
                        summary['high'] += 1
                    elif severity == 'MEDIUM':
                        summary['medium'] += 1
                    elif severity == 'LOW':
                        summary['low'] += 1
        except Exception as e:
            print(f"Error reading Bandit report: {e}")
        
        # Analyze Trivy report
        try:
            with open(trivy_path, 'r') as f:
                trivy_data = json.load(f)
                results = trivy_data.get('Results', [])
                
                for result in results:
                    vulns = result.get('Vulnerabilities', [])
                    summary['trivy_vulns'] += len(vulns)
                    
                    for vuln in vulns:
                        severity = vuln.get('Severity', '').upper()
                        if severity == 'CRITICAL':
                            summary['critical'] += 1
                        elif severity == 'HIGH':
                            summary['high'] += 1
                        elif severity == 'MEDIUM':
                            summary['medium'] += 1
                        elif severity == 'LOW':
                            summary['low'] += 1
        except Exception as e:
            print(f"Error reading Trivy report: {e}")
        
        summary['total'] = summary['critical'] + summary['high'] + summary['medium'] + summary['low']
        
        # Calculate security score
        score = 100
        score -= summary['critical'] * 15
        score -= summary['high'] * 8
        score -= summary['medium'] * 3
        score -= summary['low'] * 1
        summary['security_score'] = max(0, min(100, score))
        
        return summary
    
    def _evaluate_deployment(self, score: int, summary: Dict[str, Any]) -> bool:
        """Evaluate if deployment should be allowed"""
        # Block if score is too low
        if score < 70:
            return False
        # Block if any critical vulnerabilities
        if summary.get('critical', 0) > 0:
            return False
        # Block if too many high vulnerabilities
        if summary.get('high', 0) > 5:
            return False
        return True
    
    def _generate_decision_report(self, pipeline: PipelineRun):
        """Generate security decision JSON report"""
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
            if pipeline.security_score < 70:
                decision_report["reasons"].append(f"Security score ({pipeline.security_score}) below threshold (70)")
            if pipeline.vulnerability_summary.get('critical', 0) > 0:
                decision_report["reasons"].append(f"Critical vulnerabilities found: {pipeline.vulnerability_summary['critical']}")
            if pipeline.vulnerability_summary.get('high', 0) > 5:
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

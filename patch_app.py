import re

with open('dashboard/app.py', 'r') as f:
    content = f.read()

# 1. Update trigger_pipeline to set github_repo
content = re.sub(
    r'pipeline_record = Pipeline\(',
    r'github_repo_val = None\n    if repo_url and "github.com/" in repo_url:\n        github_repo_val = repo_url.split("github.com/")[-1].replace(".git", "")\n\n    pipeline_record = Pipeline(\n        github_repo=github_repo_val,',
    content,
    count=1
)

# 2. Update get_pipelines
s1_old = """    q = Pipeline.query.order_by(Pipeline.created_at.desc())

    # Admins can pass ?all=true to see the global view; everyone else is scoped
    if not (show_all and current_user["role"] == "admin"):
        q = q.filter(Pipeline.user_id == current_user["id"])"""
s1_new = """    q = Pipeline.query.order_by(Pipeline.created_at.desc())

    # Admins can pass ?all=true to see the global view; everyone else is scoped
    if not (show_all and current_user["role"] == "admin"):
        q = q.filter(Pipeline.user_id == current_user["id"])
    
    repo = request.args.get("repo")
    if repo:
        q = q.filter(Pipeline.github_repo == repo)"""
content = content.replace(s1_old, s1_new)

# 3. Update get_pipeline_trends
s2_old = """    pipelines = (
        Pipeline.query
        .filter(Pipeline.user_id == current_user["id"])
        .order_by(Pipeline.created_at.asc())
        .limit(limit)
        .all()
    )"""
s2_new = """    q = Pipeline.query.filter(Pipeline.user_id == current_user["id"])
    repo = request.args.get("repo")
    if repo:
        q = q.filter(Pipeline.github_repo == repo)
    pipelines = q.order_by(Pipeline.created_at.asc()).limit(limit).all()"""
content = content.replace(s2_old, s2_new)

# 4. Update get_latest_pipeline
s3_old = """    pipeline = (
        Pipeline.query
        .filter(Pipeline.user_id == current_user["id"])
        .order_by(Pipeline.created_at.desc())
        .first()
    )"""
s3_new = """    q = Pipeline.query.filter(Pipeline.user_id == current_user["id"])
    repo = request.args.get("repo")
    if repo:
        q = q.filter(Pipeline.github_repo == repo)
    pipeline = q.order_by(Pipeline.created_at.desc()).first()"""
content = content.replace(s3_old, s3_new)

# 5. Patch report queries: sast, dast, trivy, gitleaks, bandit, summary
# They all do: 
#     pipeline = (
#         Pipeline.query
#         .filter(Pipeline.user_id == current_user["id"])
#         .order_by(Pipeline.created_at.desc())
#         .first()
#     )
# I will use a regex to replace this block for all routes!

s_report_old_re = re.compile(
    r'pipeline = \(\s*Pipeline\.query\s*\.filter\(Pipeline\.user_id == current_user\["id"\]\)\s*\.order_by\(Pipeline\.created_at\.desc\(\)\)\s*\.first\(\)\s*\)'
)
s_report_new = """q = Pipeline.query.filter(Pipeline.user_id == current_user["id"])
    repo = request.args.get("repo")
    if repo:
        q = q.filter(Pipeline.github_repo == repo)
    pipeline = q.order_by(Pipeline.created_at.desc()).first()"""

content = s_report_old_re.sub(s_report_new, content)

with open('dashboard/app.py', 'w') as f:
    f.write(content)

print("dashboard/app.py patched!")

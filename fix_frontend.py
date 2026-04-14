import os
import re

files = [
    "dashboard/frontend/src/pages/SASTReport.jsx",
    "dashboard/frontend/src/pages/DastReport.jsx",
    "dashboard/frontend/src/pages/TrivyReport.jsx",
    "dashboard/frontend/src/pages/BanditReport.jsx"
]

for fpath in files:
    if not os.path.exists(fpath): continue
    with open(fpath, 'r') as f:
        content = f.read()
    
    # 1. Add import
    if "import { useRepo }" not in content:
        content = content.replace("from '../services/api'", "from '../services/api'\nimport { useRepo } from '../context/RepoContext'")

    # 2. Add useRepo hook
    # Find the export default function ...() {
    func_match = re.search(r'export default function (\w+)\(\) \{', content)
    if func_match and "const { selectedRepo }" not in content:
        content = content.replace(func_match.group(0), func_match.group(0) + "\n  const { selectedRepo } = useRepo()")

    # 3. Modify useEffect to use selectedRepo
    # Typically: useEffect(() => { fetchXReport().then... }, [])
    # Change to: useEffect(() => { setLoading(true); fetchXReport(selectedRepo?.full_name).then... }, [selectedRepo])
    
    report_name = fpath.split('/')[-1].replace('.jsx', '')
    fetch_func = f"fetch{report_name}"
    
    # regex replace fetchXReport() with fetchXReport(selectedRepo?.full_name)
    content = re.sub(fr'{fetch_func}\(\)', f'{fetch_func}(selectedRepo?.full_name)', content)
    
    # regex replace }, []) with }, [selectedRepo])
    # But only the one containing fetch
    
    # A bit tricky, let's just do a string replace if it's simple:
    content = content.replace("}, [])", "}, [selectedRepo])")
    
    with open(fpath, 'w') as f:
        f.write(content)
    print(f"Patched {fpath}")


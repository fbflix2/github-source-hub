import os
import subprocess
import json

def run_query(query):
    result = subprocess.run(['psql', '-c', query, '--json=auto'], capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        return []

search_term = 'MPOXGICL'

tables = run_query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
for table in tables:
    table_name = table['table_name']
    columns = run_query(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
    for column in columns:
        col_name = column['column_name']
        col_type = column['data_type']
        
        if col_type in ['text', 'character varying', 'jsonb', 'uuid']:
            query = f"SELECT * FROM public.{table_name} WHERE \"{col_name}\"::text ILIKE '%{search_term}%' LIMIT 1"
            res = run_query(query)
            if res:
                print(f"Found in table: {table_name}, column: {col_name}")
                print(res)

import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from api import tools, user_api

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")

if not API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment")

client = OpenAI(api_key=API_KEY)
function_schemas = [{"type": "function", "function": schema} for schema in tools.tool_schemas.values()]

first_query = [
    {"role": "system", "content": "You are a helpful assistant. Use tools when needed."},
    {"role": "user", "content": "Add a node labeled 'Curiosity' with belief type 'emotion' and confidence 0.95. Then connect it (via an edge) with relationship('related to') a different node labeled 'Exploration' with belief type 'goal' and confidence 0.85."},
]

def call_gpt():
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=first_query,
        tools=function_schemas,
        tool_choice="auto",
        temperature=0.7,
        top_p=0.95,
        max_tokens=2048,
    )

    message = response.choices[0].message

    if message.tool_calls:
        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)
            if function_name in tools.tool_registry:
                result = tools.tool_registry[function_name](**arguments)
                print(f"Tool `{function_name}` called with result: {result}")
            else:
                print(f"Unknown tool: {function_name}")
    else:
        print("Response:", message.content)

if __name__ == "__main__":
    call_gpt()
    print(user_api.export_graph_json())

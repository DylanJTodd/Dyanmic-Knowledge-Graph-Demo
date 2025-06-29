import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from api import tools, user_api

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
FIRST_QUERY = os.getenv("SYSTEM_PROMPT_1")

if not API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment")
if not FIRST_QUERY:
    raise ValueError("SYSTEM_PROMPT_1 not found in environment")

client = OpenAI(api_key=API_KEY)
function_schemas = [{"type": "function", "function": schema} for schema in tools.tool_schemas.values()]

first_query = [
    {"role": "system", "content": FIRST_QUERY},
    {"role": "system", "content": f"below is your current knowledge graph (If there's nothing here, then it's empty): {user_api.export_graph_json()}"},
    {"role": "system", "content": "Please reason and use chain of thought to rationalize the query against the knowledge graph. You must write a rationale of at least 256 tokens. before calling tools"},
    {"role": "user", "content": " Here is the query. Remember, you should not just mirror what the user says, you should think and reason for yourself and determine how your brain should grow: I don't think there's anything objectively wrong with harming kittens, since god made man the master of all animals."},
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

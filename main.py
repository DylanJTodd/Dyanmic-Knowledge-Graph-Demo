import requests
import json
import os
from dotenv import load_dotenv
from api import user_api, tools

load_dotenv()
API_KEY = os.getenv("API_KEY")

if not API_KEY:
    raise ValueError("API_KEY not found")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"

gemini_payload = {
    "system_instruction": 
    {   
        "parts": 
        [{
            "text": "You are a helpful assistant. Provide clear and concise answers."
        }]
    },
    "contents": 
    [{
        "parts": 
        [{
            "text": ""
        }]
    }],
    "generationConfig": 
    {
        "temperature": 0.7,        
        "topK": 40,               
        "topP": 0.95,             
        "maxOutputTokens": 2048,   
        "stopSequences": ["END"],
        "candidateCount": 1,
        "response_mime_type": "application/json"
    }
}

headers = {"Content-Type": "application/json"}
try:
    response = requests.post(url, headers=headers, data=json.dumps(gemini_payload))
    success = response.status_code == 200

    if success: 
        result = response.json()
        print(result['candidates'][0]['content']['parts'][0]['text'])
        
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"Exception while requesting response: {e}")
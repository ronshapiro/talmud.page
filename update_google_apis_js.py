import requests

response = requests.get("https://apis.google.com/js/api.js")

with open("js/google_apis.js", "w") as f:
    f.write(f"""// Auto generated with update_google_apis_js.py

{response.text}

export default gapi;
""")

import json
import urllib.request
import urllib.parse
import os
import websocket
import uuid
import sys
import time
import argparse
import subprocess
import socket

def wait_for_server(server_address="127.0.0.1:8188", timeout=120):
    host, port = server_address.split(":")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, int(port)), timeout=1):
                return True
        except (ConnectionRefusedError, TimeoutError, OSError):
            time.sleep(1)
    return False

def queue_prompt(prompt, client_id, server_address="127.0.0.1:8188"):
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(f"http://{server_address}/prompt", data=data)
    response = urllib.request.urlopen(req)
    return json.loads(response.read())

def get_image(filename, subfolder, folder_type, server_address="127.0.0.1:8188"):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen(f"http://{server_address}/view?{url_values}") as response:
        return response.read()

def get_history(prompt_id, server_address="127.0.0.1:8188"):
    with urllib.request.urlopen(f"http://{server_address}/history/{prompt_id}") as response:
        return json.loads(response.read())

def free_memory(server_address="127.0.0.1:8188"):
    try:
        data = json.dumps({"unload_models": True, "free_memory": True}).encode('utf-8')
        req = urllib.request.Request(f"http://{server_address}/free", data=data, method="POST")
        urllib.request.urlopen(req)
        print("[VISUAL_ENGINE] VRAM successfully freed via endpoint.")
    except Exception as e:
        print(f"[VISUAL_ENGINE] Fallback: Trying default /free endpoint. Previous error: {e}")
        try:
             req = urllib.request.Request(f"http://{server_address}/free", method="POST")
             urllib.request.urlopen(req)
        except Exception as e2:
             print(f"[VISUAL_ENGINE] Failed to release VRAM: {e2}")

def get_images(ws, prompt, client_id, server_address="127.0.0.1:8188"):
    prompt_id = queue_prompt(prompt, client_id, server_address)['prompt_id']
    output_images = {}
    
    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                if data['node'] is None and data['prompt_id'] == prompt_id:
                    break # Execution is done
        else:
            continue # Binary data, skip it

    history = get_history(prompt_id, server_address)[prompt_id]
    for node_id in history['outputs']:
        node_output = history['outputs'][node_id]
        if 'images' in node_output:
            images_output = []
            for image in node_output['images']:
                image_data = get_image(image['filename'], image['subfolder'], image['type'], server_address)
                images_output.append(image_data)
            output_images[node_id] = images_output

    return output_images

def generate_images_from_json(json_path, output_dir, server_address="127.0.0.1:8188"):
    with open(json_path, "r", encoding="utf-8") as f:
        prompts = json.load(f)
        
    client_id = str(uuid.uuid4())
    comfyui_dir = os.path.join(os.path.dirname(__file__), "ComfyUI")
    workflow_path = os.path.join(comfyui_dir, "flux2_klein_api.json")
    
    if not os.path.exists(workflow_path):
        print(f"[ERROR] Workflow not found: {workflow_path}")
        return False
        
    # Auto-boot ComfyUI server if not running
    comfy_proc = None
    print(f"\n[VISUAL_ENGINE] Checking ComfyUI connection at {server_address}...")
    if not wait_for_server(server_address, timeout=1):
        print(f"[VISUAL_ENGINE] ComfyUI server is offline. Booting headless server...")
        main_script = os.path.join(comfyui_dir, "main.py")
        
        flags = ["--disable-auto-launch", "--disable-mmap"]
        comfy_proc = subprocess.Popen([sys.executable, main_script] + flags, cwd=comfyui_dir)
        
        print("[VISUAL_ENGINE] Waiting for API to warm up (This may take ~10 seconds)...")
        if not wait_for_server(server_address, timeout=120):
            print("[ERROR] ComfyUI server failed to boot within timeout.")
            if comfy_proc: comfy_proc.terminate()
            return False
        
        print("[VISUAL_ENGINE] Server is online and accepting connections.")
    
    print(f"[VISUAL_ENGINE] Connecting WebSocket for batch rendering...")
    try:
        ws = websocket.WebSocket()
        ws.connect(f"ws://{server_address}/ws?clientId={client_id}")
    except Exception as e:
        print(f"[ERROR] WebSocket connection failed: {e}")
        if comfy_proc: comfy_proc.terminate()
        return False
        
    with open(workflow_path, "r", encoding="utf-8") as f:
        base_workflow = json.load(f)
        
    for p_obj in prompts:
        act_name = p_obj.get("act", "unknown")
        prompt_text = p_obj.get("prompt", "")
        
        output_path = os.path.join(output_dir, f"{act_name}.png")
        print(f"[VISUAL_ENGINE] Processing: {act_name}")
        print(f"                Prompt: '{prompt_text[:70]}...'")
        
        # Clone workflow to cleanly inject the prompt
        workflow = json.loads(json.dumps(base_workflow))
        
        for node_id, node_data in workflow.items():
            class_type = node_data.get("class_type", "")
            if class_type == "PrimitiveStringMultiline" and "value" in node_data.get("inputs", {}):
                node_data["inputs"]["value"] = prompt_text
            elif class_type in ["CLIPTextEncode", "CLIPTextEncodeFlux"]:
                if "text" in node_data["inputs"]: node_data["inputs"]["text"] = prompt_text
                elif "clip_l" in node_data["inputs"]: node_data["inputs"]["clip_l"] = prompt_text
                if "t5xxl" in node_data["inputs"]: node_data["inputs"]["t5xxl"] = prompt_text
                
        try:
            images = get_images(ws, workflow, client_id, server_address)
            for node_id in images:
                for image_data in images[node_id]:
                    with open(output_path, "wb") as f:
                        f.write(image_data)
                    print(f"                -> Success. Saved to: {output_path}")
        except Exception as e:
            print(f"[ERROR] Failed to render {act_name}: {e}")
            
    # Cleanup logic
    free_memory(server_address)
    ws.close()
    
    if comfy_proc:
        print("[VISUAL_ENGINE] Workload completed. Shutting down ComfyUI server to release system resources...")
        comfy_proc.terminate()
        comfy_proc.wait(timeout=10)
        
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MediaHub Visual Engine - Batch ComfyUI API Wrapper")
    parser.add_argument("--prompts_json", help="Path to JSON containing scenes to render")
    parser.add_argument("--output_dir", help="Directory to save generated images")
    parser.add_argument("--prompt", help="(LEGACY) Direct text, fallback for single image", default="")
    parser.add_argument("--output", help="(LEGACY) Final path for single image", default="")
    
    args = parser.parse_args()
    
    if args.prompts_json and args.output_dir:
        generate_images_from_json(args.prompts_json, args.output_dir)
    elif args.prompt and args.output:
        act_name = os.path.splitext(os.path.basename(args.output))[0]
        temp_json = [{"act": act_name, "prompt": args.prompt}]
        temp_path = "temp_visual_prompts.json"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(temp_json, f)
        
        generate_images_from_json(temp_path, os.path.dirname(args.output))
        if os.path.exists("temp_visual_prompts.json"): os.remove("temp_visual_prompts.json")
    else:
        print("[ERROR] Missing arguments. Use --prompts_json and --output_dir.")


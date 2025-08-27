import os
import json
import subprocess
from pathlib import Path
from datetime import datetime
import time

# 设置路径和 API Key
ROOT_DIR = Path("./processed_bridge")
LOG_FILE = ROOT_DIR / f"slither_analysis_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
ETHERSCAN_API_KEY = "MCUGMQ7XQIUZXCI3M36AT4X8R2C8BHNKRX"

# 所有可用 detector
ALL_DETECTORS = [
    "risk_event_parser",
    "unlimited-crosschain-message-call",
    "incorrect-source-message",
    "cross-message-replay",
    "uncheck_hashlock_or_timelock",
    "bypassing-crosschain-message-check-notary",
    "bypassing-crosschain-message-check-relayer",
    "bypassing-crosschain-message-check-op"
]

# 类型 -> 对应 detector 映射
BRIDGE_TYPE_TO_DETECTORS = {
    "HTLC": ["risk_event_parser", "unlimited-crosschain-message-call", "incorrect-source-message", "cross-message-replay", "uncheck_hashlock_or_timelock"],
    "Notary": ["risk_event_parser", "unlimited-crosschain-message-call", "incorrect-source-message", "cross-message-replay", "bypassing-crosschain-message-check-notary"],
    "Relayer": ["risk_event_parser", "unlimited-crosschain-message-call", "incorrect-source-message", "cross-message-replay", "bypassing-crosschain-message-check-relayer"],
    "Optimistic": ["risk_event_parser", "unlimited-crosschain-message-call", "incorrect-source-message", "cross-message-replay", "bypassing-crosschain-message-check-op"]
}

def log(message):
    timestamped_message = f"{datetime.now()} - {message}"
    print(timestamped_message)  # 控制台输出
    with open(LOG_FILE, "a") as f:
        f.write(timestamped_message + "\n")  # 写入日志文件

def find_config_json(folder_path: Path):
    for root, _, files in os.walk(folder_path):
        if "config.json" in files:
            return Path(root) / "config.json"
    return None

def is_single_sol_with_config(folder: Path) -> bool:
    sol_files = list(folder.glob("*.sol"))
    return len(sol_files) == 1 and (folder / "config.json").exists()

def parse_signatures(sig_list):
    return ';'.join(sig_list) if sig_list else ""

def run_slither(address: str, detectors, env_vars):
    detectors_str = ",".join(detectors)
    cmd = [
        "python3", "-m", "slither", address,
        "--etherscan-apikey", ETHERSCAN_API_KEY,
        "--detect", detectors_str
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, env={**os.environ, **env_vars})
    log(f"[{address}] Running detectors: {detectors_str}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")

def main():
    for contract_dir in ROOT_DIR.iterdir():
        if not contract_dir.is_dir():
            continue

        address = contract_dir.name.split("-")[0]
        config_path = None

        # 检查单文件合约 + config
        if is_single_sol_with_config(contract_dir):
            config_path = contract_dir / "config.json"
        else:
            # 多文件合约，去 bridge_analysis_result 下查找 config.json
            bridge_result_dir = contract_dir / "bridge_analysis_result"
            if bridge_result_dir.exists():
                config_path = find_config_json(bridge_result_dir)

        if not config_path or not config_path.exists():
            log(f"[{address}] Skipped: no config.json found.")
            continue

        try:
            with open(config_path, "r") as f:
                config = json.load(f)
        except Exception as e:
            log(f"[{address}] Failed to load config.json: {e}")
            continue

        bridge_type = config.get("Type")
        detectors = BRIDGE_TYPE_TO_DETECTORS.get(bridge_type, ALL_DETECTORS)

        env_vars = {
            "SEND_SIGS": parse_signatures(config.get("Source_Function_Signature")),
            "RECEIVE_SIGS": parse_signatures(config.get("Destination_Function_Signature")),
            "SEND_EVENT": parse_signatures(config.get("Source_Message_Event")),
            "RECEIVE_EVENT": parse_signatures(config.get("Destination_Message_Event")),
            "SEND_CALL": parse_signatures(config.get("Source_Message_External_Call")),
            "RECEIVE_CALL": parse_signatures(config.get("Destination_Message_External_Call")),
        }

        log(f"[{address}] Starting analysis. Type: {bridge_type or 'None (default all detectors)'}")
        run_slither(address, detectors, env_vars)

if __name__ == "__main__":
    main()

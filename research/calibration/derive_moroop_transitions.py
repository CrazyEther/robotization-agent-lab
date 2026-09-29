"""Verify archived MoRoOp bytes and extract observed robot state changes.

This research output contains sampled observations only. It is not an
availability calendar for a warehouse project.
"""

import argparse
import hashlib
import json
from pathlib import Path

import duckdb


TRANSFORM_VERSION = 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    files = {}
    for item in manifest["files"]:
        source = args.manifest.parent / item["local_file"]
        if not source.is_file():
            raise ValueError(f"Missing archived source: {source}")
        raw = source.read_bytes()
        if len(raw) != item["bytes"] or hashlib.sha256(raw).hexdigest() != item["sha256"]:
            raise ValueError(f"Archived source checksum mismatch: {source}")
        files[item["kind"]] = source

    source = files["robot_state_cleaned"]
    connection = duckdb.connect(database=":memory:")
    records = connection.execute(
        "SELECT id, created_at, state, is_robot_charging "
        "FROM read_parquet(?) ORDER BY created_at, id", [str(source)]
    ).fetchall()
    if not records:
        raise ValueError("Robot telemetry source has no observations")
    transitions = []
    previous = None
    ids = set()
    for identifier, observed_at, state, charging in records:
        if identifier is None or identifier in ids or observed_at is None:
            raise ValueError("Duplicate ID or missing timestamp in telemetry")
        if observed_at.utcoffset() is None:
            raise ValueError("Telemetry timestamp lacks time zone")
        ids.add(identifier)
        observed = (state, charging)
        if observed != previous:
            transitions.append({
                "source_id": identifier,
                "observed_at": observed_at.isoformat(),
                "state": state,
                "is_robot_charging": charging,
            })
        previous = observed

    result = {
        "transform_version": TRANSFORM_VERSION,
        "dataset_url": manifest["dataset_url"],
        "revision": manifest["revision"],
        "license": manifest["license"],
        "source_file": source.name,
        "source_sha256": next(item["sha256"] for item in manifest["files"]
                              if item["kind"] == "robot_state_cleaned"),
        "observation_count": len(records),
        "transition_count": len(transitions),
        "first_observed_at": records[0][1].isoformat(),
        "last_observed_at": records[-1][1].isoformat(),
        "semantics": "Observed samples only; no continuous availability inferred.",
        "transitions": transitions,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    print(json.dumps({key: result[key] for key in (
        "observation_count", "transition_count", "first_observed_at", "last_observed_at"
    )}, ensure_ascii=False))


if __name__ == "__main__":
    main()
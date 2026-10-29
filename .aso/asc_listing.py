#!/usr/bin/env python3
"""Push the App Store listing in .aso/listing.json to App Store Connect.

Never submits for review: it stops with the version in Prepare for Submission
so a human can check the page and press Submit.

    export ASC_KEY_ID=...  ASC_ISSUER_ID=...
    # key file: ASC_KEY_PATH, or ~/.appstoreconnect/private_keys/AuthKey_<id>.p8
    python3 .aso/asc_listing.py inspect   # read-only: print current state
    python3 .aso/asc_listing.py apply     # version, text, category, screenshots
    python3 .aso/asc_listing.py build     # wait for the build, attach it

Needs: pip install pyjwt cryptography requests
"""
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import jwt
import requests

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / ".aso" / "listing.json").read_text())
API = "https://api.appstoreconnect.apple.com/v1"
EDITABLE_STATES = {
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
}


def _token():
    key_id = os.environ["ASC_KEY_ID"]
    key_path = os.environ.get("ASC_KEY_PATH") or os.path.expanduser(
        f"~/.appstoreconnect/private_keys/AuthKey_{key_id}.p8"
    )
    now = int(time.time())
    return jwt.encode(
        {
            "iss": os.environ["ASC_ISSUER_ID"],
            "iat": now,
            "exp": now + 15 * 60,
            "aud": "appstoreconnect-v1",
        },
        Path(key_path).read_text(),
        algorithm="ES256",
        headers={"kid": key_id},
    )


def call(method, path, body=None, params=None):
    url = path if path.startswith("http") else API + path
    res = requests.request(
        method,
        url,
        json=body,
        params=params,
        headers={"Authorization": f"Bearer {_token()}"},
        timeout=60,
    )
    if res.status_code >= 400:
        sys.exit(f"{method} {path} -> {res.status_code}\n{res.text}")
    return res.json() if res.content else {}


def get_app():
    apps = call("GET", "/apps", params={"filter[bundleId]": CONFIG["bundleId"]})["data"]
    if not apps:
        sys.exit(f"No app with bundle id {CONFIG['bundleId']}")
    return apps[0]


def find_version(app_id):
    versions = call(
        "GET",
        f"/apps/{app_id}/appStoreVersions",
        params={"filter[platform]": "IOS", "limit": 20},
    )["data"]
    for v in versions:
        if v["attributes"]["versionString"] == CONFIG["version"]:
            return v
    return None


def editable_app_info(app_id):
    infos = call("GET", f"/apps/{app_id}/appInfos")["data"]
    for info in infos:
        state = info["attributes"].get("appStoreState") or info["attributes"].get("state")
        if state in EDITABLE_STATES:
            return info
    return None


def by_locale(items):
    return {i["attributes"]["locale"]: i for i in items}


def inspect():
    app = get_app()
    print(f"App {app['attributes']['name']} ({app['id']}), primary locale {app['attributes']['primaryLocale']}")
    for v in call("GET", f"/apps/{app['id']}/appStoreVersions", params={"limit": 5})["data"]:
        a = v["attributes"]
        print(f"  version {a['versionString']}: {a['appStoreState']}")
    for info in call("GET", f"/apps/{app['id']}/appInfos")["data"]:
        a = info["attributes"]
        print(f"  appInfo {info['id']}: {a.get('appStoreState') or a.get('state')}")
    version = find_version(app["id"]) or call(
        "GET", f"/apps/{app['id']}/appStoreVersions", params={"limit": 1}
    )["data"][0]
    print(f"Screenshot sets on {version['attributes']['versionString']}:")
    for loc in call("GET", f"/appStoreVersions/{version['id']}/appStoreVersionLocalizations")["data"]:
        sets = call("GET", f"/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")["data"]
        for s in sets:
            shots = call("GET", f"/appScreenshotSets/{s['id']}/appScreenshots")["data"]
            print(f"  {loc['attributes']['locale']} {s['attributes']['screenshotDisplayType']}: {len(shots)}")
    builds = call(
        "GET",
        "/builds",
        params={"filter[app]": app["id"], "sort": "-uploadedDate", "limit": 3},
    )["data"]
    for b in builds:
        a = b["attributes"]
        print(f"  build {a['version']}: {a['processingState']} (uploaded {a['uploadedDate']})")


def ensure_version(app_id):
    version = find_version(app_id)
    if version:
        state = version["attributes"]["appStoreState"]
        if state not in EDITABLE_STATES:
            sys.exit(f"Version {CONFIG['version']} is {state}; not editable")
        print(f"Using existing version {CONFIG['version']} ({state})")
        return version
    print(f"Creating version {CONFIG['version']}")
    return call(
        "POST",
        "/appStoreVersions",
        {
            "data": {
                "type": "appStoreVersions",
                "attributes": {"platform": "IOS", "versionString": CONFIG["version"]},
                "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
            }
        },
    )["data"]


def set_text(app_id, version_id):
    version_locs = by_locale(
        call("GET", f"/appStoreVersions/{version_id}/appStoreVersionLocalizations")["data"]
    )
    info = editable_app_info(app_id)
    if not info:
        sys.exit("No editable appInfo; name/subtitle/category need a version in Prepare for Submission")
    info_locs = by_locale(call("GET", f"/appInfos/{info['id']}/appInfoLocalizations")["data"])

    for locale, text in CONFIG["localizations"].items():
        if locale not in version_locs or locale not in info_locs:
            sys.exit(f"Locale {locale} missing on the version or app info")
        call(
            "PATCH",
            f"/appInfoLocalizations/{info_locs[locale]['id']}",
            {
                "data": {
                    "type": "appInfoLocalizations",
                    "id": info_locs[locale]["id"],
                    "attributes": {"name": text["name"], "subtitle": text["subtitle"]},
                }
            },
        )
        call(
            "PATCH",
            f"/appStoreVersionLocalizations/{version_locs[locale]['id']}",
            {
                "data": {
                    "type": "appStoreVersionLocalizations",
                    "id": version_locs[locale]["id"],
                    "attributes": {
                        k: text[k]
                        for k in ("description", "keywords", "promotionalText", "whatsNew")
                    },
                }
            },
        )
        print(f"Text set for {locale}")

    call(
        "PATCH",
        f"/appInfos/{info['id']}",
        {
            "data": {
                "type": "appInfos",
                "id": info["id"],
                "relationships": {
                    "primaryCategory": {
                        "data": {"type": "appCategories", "id": CONFIG["primaryCategory"]}
                    },
                    "secondaryCategory": {
                        "data": {"type": "appCategories", "id": CONFIG["secondaryCategory"]}
                    },
                    # Subcategories only exist under Games/Stickers; clear stale ones.
                    "primarySubcategoryOne": {"data": None},
                    "primarySubcategoryTwo": {"data": None},
                    "secondarySubcategoryOne": {"data": None},
                    "secondarySubcategoryTwo": {"data": None},
                },
            }
        },
    )
    print(f"Category set to {CONFIG['primaryCategory']} / {CONFIG['secondaryCategory']}")
    return version_locs


def upload_screenshot(set_id, path):
    data = path.read_bytes()
    shot = call(
        "POST",
        "/appScreenshots",
        {
            "data": {
                "type": "appScreenshots",
                "attributes": {"fileName": path.name, "fileSize": len(data)},
                "relationships": {
                    "appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}
                },
            }
        },
    )["data"]
    for op in shot["attributes"]["uploadOperations"]:
        chunk = data[op["offset"] : op["offset"] + op["length"]]
        headers = {h["name"]: h["value"] for h in op["requestHeaders"]}
        res = requests.request(op["method"], op["url"], data=chunk, headers=headers, timeout=120)
        res.raise_for_status()
    call(
        "PATCH",
        f"/appScreenshots/{shot['id']}",
        {
            "data": {
                "type": "appScreenshots",
                "id": shot["id"],
                "attributes": {
                    "uploaded": True,
                    "sourceFileChecksum": hashlib.md5(data).hexdigest(),
                },
            }
        },
    )
    return shot["id"]


def set_screenshots(version_locs):
    for locale in CONFIG["localizations"]:
        loc_id = version_locs[locale]["id"]
        sets = {
            s["attributes"]["screenshotDisplayType"]: s
            for s in call("GET", f"/appStoreVersionLocalizations/{loc_id}/appScreenshotSets")["data"]
        }
        for display_type, folder in CONFIG["screenshots"].items():
            files = sorted((ROOT / folder).glob("*.png"))
            if not files:
                sys.exit(f"No screenshots in {folder}")
            if display_type in sets:
                set_id = sets[display_type]["id"]
                for old in call("GET", f"/appScreenshotSets/{set_id}/appScreenshots")["data"]:
                    call("DELETE", f"/appScreenshots/{old['id']}")
            else:
                set_id = call(
                    "POST",
                    "/appScreenshotSets",
                    {
                        "data": {
                            "type": "appScreenshotSets",
                            "attributes": {"screenshotDisplayType": display_type},
                            "relationships": {
                                "appStoreVersionLocalization": {
                                    "data": {"type": "appStoreVersionLocalizations", "id": loc_id}
                                }
                            },
                        }
                    },
                )["data"]["id"]
            ids = [upload_screenshot(set_id, f) for f in files]
            call(
                "PATCH",
                f"/appScreenshotSets/{set_id}/relationships/appScreenshots",
                {"data": [{"type": "appScreenshots", "id": i} for i in ids]},
            )
            print(f"{locale} {display_type}: uploaded {len(ids)} from {folder}")

        # Apple processes uploads asynchronously; report any that fail.
        deadline = time.time() + 300
        while time.time() < deadline:
            states = []
            for display_type in CONFIG["screenshots"]:
                sets = call("GET", f"/appStoreVersionLocalizations/{loc_id}/appScreenshotSets")["data"]
                for s in sets:
                    if s["attributes"]["screenshotDisplayType"] != display_type:
                        continue
                    for shot in call("GET", f"/appScreenshotSets/{s['id']}/appScreenshots")["data"]:
                        state = (shot["attributes"].get("assetDeliveryState") or {}).get("state")
                        states.append((shot["attributes"]["fileName"], state, shot["attributes"].get("assetDeliveryState")))
            failed = [s for s in states if s[1] == "FAILED"]
            if failed:
                sys.exit(f"Screenshot processing failed: {failed}")
            if all(s[1] == "COMPLETE" for s in states):
                print(f"{locale}: all {len(states)} screenshots processed")
                break
            time.sleep(10)
        else:
            print(f"{locale}: screenshots still processing after 5 min; check App Store Connect")


def attach_build(app_id, version_id):
    deadline = time.time() + 60 * 60
    while True:
        builds = call(
            "GET",
            "/builds",
            params={
                "filter[app]": app_id,
                "filter[version]": CONFIG["build"],
                "filter[preReleaseVersion.version]": CONFIG["version"],
            },
        )["data"]
        state = builds[0]["attributes"]["processingState"] if builds else "NOT_FOUND"
        if state == "VALID":
            break
        if state in ("FAILED", "INVALID"):
            sys.exit(f"Build {CONFIG['version']} ({CONFIG['build']}) is {state}")
        if time.time() > deadline:
            sys.exit(f"Build still {state} after an hour")
        print(f"Build {CONFIG['version']} ({CONFIG['build']}): {state}, waiting")
        time.sleep(60)

    build = builds[0]
    if build["attributes"].get("usesNonExemptEncryption") is None:
        # The app only uses standard HTTPS, which is exempt.
        call(
            "PATCH",
            f"/builds/{build['id']}",
            {
                "data": {
                    "type": "builds",
                    "id": build["id"],
                    "attributes": {"usesNonExemptEncryption": False},
                }
            },
        )
        print("Export compliance: no non-exempt encryption")
    call(
        "PATCH",
        f"/appStoreVersions/{version_id}/relationships/build",
        {"data": {"type": "builds", "id": build["id"]}},
    )
    print(f"Attached build {CONFIG['version']} ({CONFIG['build']})")


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "inspect"
    if command == "inspect":
        return inspect()
    app = get_app()
    version = ensure_version(app["id"])
    if command == "apply":
        locs = set_text(app["id"], version["id"])
        set_screenshots(locs)
    elif command == "build":
        attach_build(app["id"], version["id"])
    else:
        sys.exit(__doc__)
    print("Done. Not submitted: review the version in App Store Connect, then Submit for Review.")


if __name__ == "__main__":
    main()

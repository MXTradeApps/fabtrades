#!/usr/bin/env python3
"""Shows or applies the Google Play store listing text in .aso/play_listing.json.

    python3 .aso/play_listing.py          # compare with what is live, change nothing
    python3 .aso/play_listing.py apply    # write title and descriptions, send for review

Needs GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the service account key, as JSON text) and
`pip install google-api-python-client google-auth`. It writes the app name, short
description and full description for each language in the file, and adds a language
that is not on the listing yet. It never touches screenshots, the category or the
data safety form; those are set in Play Console.
"""
import json
import os
import pathlib
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

CONFIG = json.loads((pathlib.Path(__file__).parent / "play_listing.json").read_text())
FIELDS = ("title", "shortDescription", "fullDescription")
LIMITS = {"title": 30, "shortDescription": 80, "fullDescription": 4000}


def check():
    for lang, listing in CONFIG["listings"].items():
        for field in FIELDS:
            if len(listing[field]) > LIMITS[field]:
                sys.exit(f"{lang} {field} is {len(listing[field])} characters; Play allows {LIMITS[field]}")


def main():
    apply = sys.argv[1:] == ["apply"]
    check()
    package = CONFIG["packageName"]
    creds = service_account.Credentials.from_service_account_info(
        json.loads(os.environ["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]),
        scopes=["https://www.googleapis.com/auth/androidpublisher"],
    )
    edits = build("androidpublisher", "v3", credentials=creds, cache_discovery=False).edits()
    edit_id = edits.insert(packageName=package, body={}).execute()["id"]
    try:
        live = {
            l["language"]: l
            for l in edits.listings().list(packageName=package, editId=edit_id).execute().get("listings", [])
        }
        changed = 0
        for lang, wanted in CONFIG["listings"].items():
            now = live.get(lang)
            diff = [f for f in FIELDS if (now or {}).get(f, "") != wanted[f]]
            if not diff:
                print(f"{lang}: up to date")
                continue
            changed += 1
            print(f"{lang}: {'new language' if now is None else 'changes ' + ', '.join(diff)}")
            for field in ("title", "shortDescription"):
                if field in diff:
                    print(f"  {field}: {(now or {}).get(field, '')!r} -> {wanted[field]!r}")
            if apply:
                edits.listings().update(
                    packageName=package, editId=edit_id, language=lang, body={"language": lang, **wanted}
                ).execute()
        if not apply or not changed:
            edits.delete(packageName=package, editId=edit_id).execute()
            print("Nothing written." if not apply else "Nothing to change.")
            return
        try:
            edits.commit(packageName=package, editId=edit_id).execute()
            print("Committed the edit and sent it for review")
        except Exception as e:
            if "changesNotSentForReview" not in str(e):
                raise
            edits.commit(packageName=package, editId=edit_id, changesNotSentForReview=True).execute()
            print("Committed the edit; send it for review in Play Console (Publishing overview)")
    except BaseException:
        try:
            edits.delete(packageName=package, editId=edit_id).execute()
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()

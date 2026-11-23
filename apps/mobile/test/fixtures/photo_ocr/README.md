# Photo OCR fixtures

Each `.json` file here is what ML Kit read off one photo of several cards, plus
the cards that were really in it. `test/core/scan/photo_cards_replay_test.dart`
runs every file through `recognizePhotoCards` and prints the hit rate.

To add a real photo:

1. Run a debug build on a phone, open a Binder, choose **Post from photo**.
2. Capture the log: `adb logcat -d | Select-String "DEBUG-photo"`.
3. Copy the JSON after each `line=` into `lines`, list the card names that were
   in the photo under `expected`, and list the catalog rows the matcher may
   choose from under `catalog` (at least the expected cards, plus any that
   could be confused with them).

`synthetic_grid.json` is made up, not a real photo. Until real photos are added
here, the hit rate on real photos is unmeasured.

The replay only knows the `catalog` rows in the file, so it measures reading
and grouping, not confusion against the full live catalog.

/// RFC4180 reader for a Fabrary collection export.
const fabraryRequiredHeaders = [
  'Identifier',
  'Name',
  'Pitch',
  'Set',
  'Set number',
  'Edition',
  'Foiling',
  'Treatment',
  'Have',
];

class FabraryCsvParse {
  const FabraryCsvParse({
    required this.ok,
    this.reason,
    required this.headers,
    required this.rows,
  });

  final bool ok;
  final String? reason;
  final List<String> headers;
  final List<Map<String, String>> rows;
}

/// Split a CSV string into records. Quoted fields may contain commas.
List<List<String>> parseCsvRecords(String text) {
  final input = text.startsWith('\uFEFF') ? text.substring(1) : text;
  final rows = <List<String>>[];
  var row = <String>[];
  var field = StringBuffer();
  var i = 0;
  var inQuotes = false;

  void pushField() {
    row.add(field.toString());
    field = StringBuffer();
  }

  void pushRow() {
    if (row.length == 1 && row[0].isEmpty && !inQuotes) {
      row = <String>[];
      return;
    }
    rows.add(row);
    row = <String>[];
  }

  while (i < input.length) {
    final ch = input[i];
    if (inQuotes) {
      if (ch == '"') {
        if (i + 1 < input.length && input[i + 1] == '"') {
          field.write('"');
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field.write(ch);
      i += 1;
      continue;
    }
    if (ch == '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch == ',') {
      pushField();
      i += 1;
      continue;
    }
    if (ch == '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    if (ch == '\r') {
      i += 1;
      continue;
    }
    field.write(ch);
    i += 1;
  }
  if (inQuotes || field.isNotEmpty || row.isNotEmpty) {
    pushField();
    pushRow();
  }
  return rows;
}

bool hasFabraryHeaders(Iterable<String>? headers) {
  final list = headers?.toList() ?? const <String>[];
  return fabraryRequiredHeaders.every(list.contains);
}

FabraryCsvParse parseFabraryCsv(String text) {
  final records = parseCsvRecords(text);
  if (records.isEmpty) {
    return const FabraryCsvParse(
      ok: false,
      reason: 'not_fabrary',
      headers: [],
      rows: [],
    );
  }
  final headers = records.first.map((h) => h).toList();
  final missing =
      fabraryRequiredHeaders.where((h) => !headers.contains(h)).toList();
  if (missing.isNotEmpty) {
    return FabraryCsvParse(
      ok: false,
      reason: 'not_fabrary',
      headers: headers,
      rows: const [],
    );
  }
  final rows = records.skip(1).map((cells) {
    final row = <String, String>{};
    for (var i = 0; i < headers.length; i++) {
      row[headers[i]] = i < cells.length ? cells[i] : '';
    }
    return row;
  }).toList();
  return FabraryCsvParse(ok: true, headers: headers, rows: rows);
}

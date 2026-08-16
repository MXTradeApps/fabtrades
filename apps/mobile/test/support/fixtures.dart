import 'package:fabtrades/core/models/card_model.dart';

/// Builds a [CardModel] with sensible defaults so individual tests only need to
/// specify the fields they care about.
CardModel buildCard({
  String id = 'card-1',
  int? productId,
  String name = 'Test Card',
  String? cleanName,
  String? setName = 'Origins',
  String? subTypeName,
  bool isFoil = false,
  String? rarity = 'Common',
  String? collectorNumber = '001/219',
  String? imageUrl,
  String? cardType,
  String? cardSubType,
  DateTime? priceUpdatedAt,
  double? tcgLow,
  double? tcgMid,
  double? tcgHigh,
  double? tcgMarket,
  double? cmAvg,
  double? cmLow,
  double? cmTrend,
  double? cmAvgFoil,
  double? cmLowFoil,
  double? cmTrendFoil,
}) {
  return CardModel(
    id: id,
    productId: productId,
    name: name,
    cleanName: cleanName,
    setName: setName,
    subTypeName: subTypeName,
    isFoil: isFoil,
    rarity: rarity,
    collectorNumber: collectorNumber,
    imageUrl: imageUrl,
    cardType: cardType,
    cardSubType: cardSubType,
    priceUpdatedAt: priceUpdatedAt,
    tcgLow: tcgLow,
    tcgMid: tcgMid,
    tcgHigh: tcgHigh,
    tcgMarket: tcgMarket,
    cmAvg: cmAvg,
    cmLow: cmLow,
    cmTrend: cmTrend,
    cmAvgFoil: cmAvgFoil,
    cmLowFoil: cmLowFoil,
    cmTrendFoil: cmTrendFoil,
  );
}

/// Builds a [PricePoint] snapshot. Null Lows stay null — never coerced to 0.
PricePoint buildPricePoint({
  required DateTime capturedOn,
  double? tcgLow,
  double? cmLow,
  double? tcgMarket,
  double? cmTrend,
}) {
  return PricePoint(
    capturedOn: capturedOn,
    tcgLow: tcgLow,
    cmLow: cmLow,
    tcgMarket: tcgMarket,
    cmTrend: cmTrend,
  );
}

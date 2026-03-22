// Blur Exchange v1: 0x000000000000Ad05Ccc4F10045630fb830B95127
// OrdersMatched(address indexed maker, address indexed taker, sell Order, sellHash, buy Order, buyHash)
export const BLUR_ORDERS_MATCHED_TOPIC =
  '0xccba862546b05c8c66e45ac1e0eb064e777f59aee70b88930f052da1829fcfd7';

// Blur Blend: 0x29469395eAf6f95920E59F858042f0e28D98a20B
// Blur v2 packed execution
export const BLUR_EXECUTION_721_TOPIC =
  '0x59e7171383120f112daa541d35225ba552fec6c73281caefe0fc6f5b059c6bd0';

export const PROTOCOL_NAME = 'BLUR';

// Order struct: (trader, side, matchingPolicy, collection, tokenId, amount,
//   paymentToken, price, listingTime, expirationTime, fees[], salt, extraParams)
// Side: 0 = Buy, 1 = Sell
export const ORDER_TUPLE =
  'tuple(address trader, uint8 side, address matchingPolicy, address collection, uint256 tokenId, uint256 amount, address paymentToken, uint256 price, uint256 listingTime, uint256 expirationTime, tuple(uint16 rate, address recipient)[] fees, uint256 salt, bytes extraParams)';

export const INPUT_TUPLE =
  'tuple(uint8 order, uint256 r, uint256 s, uint256 v, bool blockNumber, address signatureVersion, bytes extraSignature)';

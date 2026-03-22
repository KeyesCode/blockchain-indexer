// Compound V2 cToken events (all non-indexed — data only, no indexed topics beyond sig)

// Mint(address minter, uint256 mintAmount, uint256 mintTokens)
export const COMPOUND_MINT_TOPIC =
  '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f';

// Redeem(address redeemer, uint256 redeemAmount, uint256 redeemTokens)
export const COMPOUND_REDEEM_TOPIC =
  '0xe5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929';

// Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)
export const COMPOUND_BORROW_TOPIC =
  '0x13ed6866d4e1ee6da46f845c46d7e54120883d75c5ea9a2dacc1c4ca8984ab80';

// RepayBorrow(address payer, address borrower, uint256 repayAmount, uint256 accountBorrows, uint256 totalBorrows)
export const COMPOUND_REPAY_TOPIC =
  '0x1a2a22cb034d26d1854bdc6666a5b91fe25efbbb5dcad3b0355478d6f5c362a1';

// LiquidateBorrow(address liquidator, address borrower, uint256 repayAmount, address cTokenCollateral, uint256 seizeTokens)
export const COMPOUND_LIQUIDATE_TOPIC =
  '0x298637f684da70674f26509b10f07ec2fbc77a335ab1e7d6215a4b2484d8bb52';

export const PROTOCOL_NAME = 'COMPOUND';

export const ALL_COMPOUND_TOPICS = [
  COMPOUND_MINT_TOPIC,
  COMPOUND_REDEEM_TOPIC,
  COMPOUND_BORROW_TOPIC,
  COMPOUND_REPAY_TOPIC,
  COMPOUND_LIQUIDATE_TOPIC,
];

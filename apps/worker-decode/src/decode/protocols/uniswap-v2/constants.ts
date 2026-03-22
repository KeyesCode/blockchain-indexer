// keccak256("Swap(address,uint256,uint256,uint256,uint256,address)")
export const UNISWAP_V2_SWAP_TOPIC =
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

export const UNISWAP_V2_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function factory() view returns (address)',
  'function getReserves() view returns (uint112, uint112, uint32)',
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
] as const;

export const PROTOCOL_NAME = 'UNISWAP_V2';

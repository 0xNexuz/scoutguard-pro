import { formatUnits, getAddress, isAddress, parseUnits } from 'ethers';
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from './blockscout-client.js';
import { TransactionCandidate } from '../types/index.js';

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const TRANSFER = /^0xa9059cbb([a-fA-F0-9]{64})([a-fA-F0-9]{64})$/;

/** Normalize the unsigned transaction that will be signed. No arbitrary contract call is a payment. */
export function normalizePayment(tx: TransactionCandidate): TransactionCandidate {
  if (!isAddress(tx.from) || !isAddress(tx.to) || !Number.isSafeInteger(tx.chainId) || !SUPPORTED_CHAINS[tx.chainId]) {
    throw new Error('Invalid sender, destination, or chain');
  }
  if (typeof tx.value !== 'string' || !DECIMAL.test(tx.value)) throw new Error('Invalid native transaction value');
  const transactionTo = getAddress(tx.to);
  const transactionValue = tx.value;

  if (tx.data && tx.data !== '0x') {
    const encoded = TRANSFER.exec(tx.data);
    if (!encoded) throw new Error('Unsupported calldata: only direct ERC-20 transfer(address,uint256) is supported');
    const token = SUPPORTED_TOKENS[tx.chainId]?.[transactionTo.toLowerCase()];
    if (!token) throw new Error('Unsupported token contract on this chain');
    if (tx.tokenAddress && getAddress(tx.tokenAddress) !== transactionTo) throw new Error('Token contract mismatch');
    if (parseUnits(transactionValue, 18) !== 0n) throw new Error('ERC-20 transfer must carry zero native value');
    if (!/^0{24}$/i.test(encoded[1].slice(0, 24))) throw new Error('Noncanonical recipient encoding');
    const recipient = getAddress(`0x${encoded[1].slice(24)}`);
    const rawAmount = BigInt(`0x${encoded[2]}`);
    return {
      ...tx,
      to: recipient,
      value: formatUnits(rawAmount, token.decimals),
      tokenAddress: token.address,
      transactionTo,
      transactionValue,
      rawAmount: rawAmount.toString(),
      data: tx.data.toLowerCase()
    };
  }
  if (tx.tokenAddress) throw new Error('Token payment requires direct transfer calldata');
  const rawAmount = parseUnits(transactionValue, 18);
  return {
    ...tx,
    to: transactionTo,
    value: formatUnits(rawAmount, 18),
    transactionTo,
    transactionValue,
    rawAmount: rawAmount.toString(),
    data: undefined
  };
}

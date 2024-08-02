import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';

export async function prepareTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  connection: Connection
) {
  const blockhash = await connection
    .getLatestBlockhash({ commitment: 'max' })
    .then((res) => res.blockhash);
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions
  }).compileToV0Message();
  return new VersionedTransaction(messageV0);
}

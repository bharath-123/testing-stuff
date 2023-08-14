const nearAPI = require("near-api-js");
const sha256 = require("js-sha256");
//this is required if using a local .env file for private key
require("dotenv").config();

// configure accounts, network, and amount of NEAR to send
// the amount is converted into yoctoNEAR (10^-24) using a near-api-js utility
const sender = "staderlabs.testnet";
const receiver = "dev-1692030956897-15359915970474";

// sets up a NEAR API/RPC provider to interact with the blockchain
const provider = new nearAPI.providers.JsonRpcProvider(
  "https://rpc.testnet.near.org"
);

// creates keyPair used to sign transaction
const privateKey = process.env.SENDER_PRIVATE_KEY;
const keyPair = new nearAPI.utils.key_pair.KeyPairEd25519(privateKey);

async function main() {
  console.log("Processing transaction...");

  // gets sender's public key
  const publicKey = keyPair.getPublicKey();

  // gets sender's public key information from NEAR blockchain
  const accessKey = await provider.query(
    `access_key/${sender}/${publicKey.toString()}`,
    ""
  );
  console.log("access key is");
  console.log(accessKey);

  // // checks to make sure provided key is a full access key
  // if (accessKey.permission !== "FullAccess") {
  //   return console.log(
  //     `Account [ ${sender} ] does not have permission to send tokens using key: [ ${publicKey} ]`
  //   );
  // }

  // each transaction requires a unique number or nonce
  // this is created by taking the current nonce and incrementing it
  const nonce = ++accessKey.nonce;

  // constructs actions that will be passed to the createTransaction method below
  const actions1 = [
    nearAPI.transactions.functionCall(
      "autocompounding_epoch",
      Buffer.from(
        JSON.stringify({
          validator: "omnistake_v5.factory01.littlefarm.testnet",
        })
      ),
      150000000000000,
      0
    ),
  ];
  const actions2 = [
    nearAPI.transactions.functionCall(
      "unstaking_epoch",
      Buffer.from(JSON.stringify({})),
      250000000000000,
      0
    ),
  ];

  // converts a recent block hash into an array of bytes
  // this hash was retrieved earlier when creating the accessKey (Line 26)
  // this is required to prove the tx was recently constructed (within 24hrs)
  const recentBlockHash = nearAPI.utils.serialize.base_decode(
    accessKey.block_hash
  );

  // create transaction
  const transaction1 = nearAPI.transactions.createTransaction(
    sender,
    publicKey,
    receiver,
    nonce,
    actions1,
    recentBlockHash
  );

  const transaction2 = nearAPI.transactions.createTransaction(
    sender,
    publicKey,
    receiver,
    nonce + 1,
    actions2,
    recentBlockHash
  );

  // before we can sign the transaction we must perform three steps...
  // 1) serialize the transaction in Borsh
  const serializedTx1 = nearAPI.utils.serialize.serialize(
    nearAPI.transactions.SCHEMA,
    transaction1
  );
  const serializedTx2 = nearAPI.utils.serialize.serialize(
    nearAPI.transactions.SCHEMA,
    transaction2
  );
  // 2) hash the serialized transaction using sha256
  const serializedTxHash1 = new Uint8Array(sha256.sha256.array(serializedTx1));
  const serializedTxHash2 = new Uint8Array(sha256.sha256.array(serializedTx2));

  // 3) create a signature using the hashed transaction
  const signature1 = keyPair.sign(serializedTxHash1);
  const signature2 = keyPair.sign(serializedTxHash2);

  // now we can sign the transaction :)
  const signedTransaction1 = new nearAPI.transactions.SignedTransaction({
    transaction: transaction1,
    signature: new nearAPI.transactions.Signature({
      keyType: transaction1.publicKey.keyType,
      data: signature1.signature,
    }),
  });
  console.log("signedtx 1 is ");
  console.log(signedTransaction1);
  const signedTransaction2 = new nearAPI.transactions.SignedTransaction({
    transaction: transaction2,
    signature: new nearAPI.transactions.Signature({
      keyType: transaction2.publicKey.keyType,
      data: signature2.signature,
    }),
  });
  console.log("signedtx 2 is");
  console.log(signedTransaction2);

  // send the transaction!

  // encodes signed transaction to serialized Borsh (required for all transactions)
  // const signedSerializedTx1 = signedTransaction1.encode();
  // sends transaction to NEAR blockchain via JSON RPC call and records the result
  const signedSerializedTx1 = nearAPI.utils.serialize.serialize(
    nearAPI.transactions.SCHEMA,
    signedTransaction1
  );
  const signedSerializedTx2 = nearAPI.utils.serialize.serialize(
    nearAPI.transactions.SCHEMA,
    signedTransaction2
  );
  const result1 = provider.sendJsonRpc("broadcast_tx_commit", [
    Buffer.from(signedSerializedTx1).toString("base64"),
  ]);
  // const signedSerializedTx2 = signedTransaction2.encode();
  // sends transaction to NEAR blockchain via JSON RPC call and records the result
  const result2 = provider.sendJsonRpc("broadcast_tx_commit", [
    Buffer.from(signedSerializedTx2).toString("base64"),
  ]);
  Promise.all([result1, result2]).then((results) => {
    for (const result of results) {
      console.log(result);
    }
  });
  // console.log("result1 is ");
  // console.log(result1);
  // console.log("result2 is ");
  // console.log(result2);
  // console results :)
  // console.log(`result1 tx hash is ${result1.transaction.hash}`);
  // console.log(`result2 tx hash is ${result2.transaction.hash}`);
}

// run the function
main();

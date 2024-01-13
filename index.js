const env = require("dotenv");
const crypto = require("@cosmjs/crypto");
const signer = require("@cosmjs/proto-signing");
const cosmos_starget = require("@cosmjs/cosmwasm-stargate");
const starget = require("@cosmjs/stargate");
const sha3 = require("@noble/hashes/sha3");
const bignumber = require("bignumber.js");

// Read env var
env.config();

async function main(){
	for(let i = 0; i < 1; i++) {
		const wallet = await signer.DirectSecp256k1HdWallet.fromMnemonic(process.env.MNEMONIC, {
			prefix: 'sei',
			hdPaths: [crypto.stringToPath(`m/44'/118'/0'/0/${i}`)]
		})
		const [firstAccount] = await wallet.getAccounts();
		
		// Client setup
		const client = await cosmos_starget.SigningCosmWasmClient.connectWithSigner(process.env.RPC, wallet, {
			gasPrice: starget.GasPrice.fromString("0.3usei")
		})
		
		// Mint param setup
		let collection = process.env.COLLECTION
		let group = null;
		let lighthouseConfig = await client.queryContractSmart(process.env.LIGHTHOUST_CONTRACT, {get_config:{}})
		let collectionConfig = await client.queryContractSmart(process.env.LIGHTHOUST_CONTRACT, {get_collection:{collection}})
		console.log(collectionConfig)
	}
}

main()
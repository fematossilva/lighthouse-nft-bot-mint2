const env = require("dotenv");
const crypto = require("@cosmjs/crypto");
const signer = require("@cosmjs/proto-signing");
const starget = require("@cosmjs/stargate");

env.config();

async function main() {
	// Load environment variable
	const mnemonic = process.env.MNEMONIC;
	const rpc = process.env.RPC;
	const wallet_count = 0;
	const amount_transfer = 1000000; // 1 SIE = 1000000 usei

	// Setup Main Wallet
	const mainWallet = await signer.DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
		prefix: "sei",
	});
	const [mainAcc] = await mainWallet.getAccounts();
	const mainClient = await starget.SigningStargateClient.connectWithSigner(rpc, mainWallet, {
		gasPrice: starget.GasPrice.fromString("0.1usei"),
	});

	// Setup Bot Wallet
	for (let i = 1; i <= wallet_count; i++) {
		let botWallet = await signer.DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
			prefix: "sei",
			hdPaths: [crypto.stringToPath(`m/44'/118'/0'/0/${i}`)],
		});
		let [botAcc] = await botWallet.getAccounts();

		// Use starget.coin method to create the amount
		const amount = starget.coin(amount_transfer.toString(), "usei");

		let sendTx = await mainClient.sendTokens(mainAcc.address, botAcc.address, [amount], "auto", "Transaction");
		console.log("======================================")
		console.info("Transfer To: ", botAcc.address);
		console.info("Tx Hash    : ", sendTx.transactionHash);
		console.log("======================================")
	}
}

main().catch((error) => {
	console.error("Error:", error);
});

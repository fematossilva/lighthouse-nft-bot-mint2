#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveLogs = void 0;
const commander_1 = require("commander");
const ora_1 = __importDefault(require("ora"));
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const proto_signing_1 = require("@cosmjs/proto-signing");
const cosmwasm_stargate_1 = require("@cosmjs/cosmwasm-stargate");
const stargate_1 = require("@cosmjs/stargate");
const merkletreejs_1 = require("merkletreejs");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const arweave_1 = require("./arweave");
const sha3_1 = require("@noble/hashes/sha3");
const path_1 = __importDefault(require("path"));
const crypto = require("@cosmjs/crypto")
const promise_pool_1 = __importDefault(require("@supercharge/promise-pool"));
const LIGHTHOUSE_CONTRACT_ATLANTIC_2 = "sei12gjnfdh2kz06qg6e4y997jfgpat6xpv9dw58gtzn6g75ysy8yt5snzf4ac";
const LIGHTHOUSE_CONTRACT_PACIFIC_1 = "sei1hjsqrfdg2hvwl3gacg4fkznurf36usrv7rkzkyh29wz3guuzeh0snslz7d";
const getLighthouseContract = (network) => {
    if (network === "pacific-1") {
        return LIGHTHOUSE_CONTRACT_PACIFIC_1;
    }
    else if (network === "atlantic-2") {
        return LIGHTHOUSE_CONTRACT_ATLANTIC_2;
    }
    else if (network === "sei-chain") {
        return "";
    }
    else {
        throw new Error("Invalid network");
    }
};
const saveLogs = (logs) => {
    //add logs to log file if exists
    if (fs_1.default.existsSync("./logs.json")) {
        let logFile = [];
        try {
            logFile = JSON.parse(fs_1.default.readFileSync("./logs.json", "utf-8"));
            logFile.push(logs);
        }
        catch (e) {
            logFile = logs;
        }
        fs_1.default.writeFileSync("./logs.json", JSON.stringify(logFile, null, 4));
    }
    else {
        fs_1.default.writeFileSync("./logs.json", JSON.stringify(logs, null, 4));
    }
};
exports.saveLogs = saveLogs;
const loadConfig = () => {
    //check if config exists
    if (fs_1.default.existsSync("./config.json")) {
        let config = JSON.parse(fs_1.default.readFileSync("./config.json", "utf-8"));
        if (!config.mnemonic || !config.rpc || !config.network) {
            console.log(chalk_1.default.red("\nConfig file is missing required fields (mnemonic, rpc, network)"));
            process.exit(1);
        }
        return config;
    }
    else {
        console.log(chalk_1.default.red("\nConfig file not found"));
        process.exit(1);
    }
};
const main = () => {
    commander_1.program
        .name("lighthouse")
        .description("Lighthouse is a tool for creating NFT collections on the SEI blockchain.")
        .version("0.3.7");
    commander_1.program
        .command("init")
        .description("Initialize a new project configuration")
        .action(() => {
            let isConfig = fs_1.default.existsSync("./config.json");
            if (isConfig) {
                inquirer_1.default.prompt([
                    {
                        type: "confirm",
                        name: "overwrite",
                        message: "A config.json file already exists. Do you want to overwrite it?",
                        default: false
                    }
                ]).then((answers) => {
                    if (answers.overwrite) {
                        console.log("Overwriting config.json");
                        createDefaultConfig();
                    }
                    else {
                        console.log("Exiting");
                    }
                });
            }
            else {
                createDefaultConfig();
            }
        });
    commander_1.program
        .command("mint")
        .description("Mint new NFTs from an existing NFT collection")
        .argument("<collection>")
        .argument("<group_name>", "Mint from a specific group")
        .option("--gas-price <gas_price>", "Gas price to use for transaction (default: 0.1)")
        .action((collection, groupName, answers) => __awaiter(void 0, void 0, void 0, function* () {
            if (groupName) {
                console.log("Minting from group: " + groupName);
            }
            else {
                console.log(chalk_1.default.red("You must specify a group to mint from"));
                return;
            }
            let config = loadConfig();
            for (let i = 0; i <= config.count; i++) {
                const wallet = yield proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(config.mnemonic, {
                    prefix: "sei",
                    hdPaths: [crypto.stringToPath(`m/44'/118'/0'/0/${i}`)]
                });
                const [firstAccount] = yield wallet.getAccounts();
                console.log(firstAccount.address)
                const client = yield cosmwasm_stargate_1.SigningCosmWasmClient.connectWithSigner(config.rpc, wallet, {
                    gasPrice: stargate_1.GasPrice.fromString(answers.gasPrice ? answers.gasPrice + "usei" : "0.1usei")
                });
                let lighthouseConfig = yield client.queryContractSmart(getLighthouseContract(config.network), { get_config: {} });
                let collectionConfig = yield client.queryContractSmart(getLighthouseContract(config.network), { get_collection: { collection } });
                let group = null;
                for (let g of collectionConfig.mint_groups) {
                    if (g.name === groupName) {
                        group = g;
                        break;
                    }
                }
                if (group === null) {
                    console.log(chalk_1.default.red("Group not found"));
                    return;
                }
                let merkleProof = null;
                let hashedAddress = null;
                // let recipient = yield inquirer_1.default.prompt([
                //     {
                //         type: "input",
                //         name: "recipient",
                //         message: "Enter recipient address (default: " + firstAccount.address + ")"
                //     }
                // ]);
                if (group.merkle_root !== "" && group.merkle_root !== null) {
                    //ask for proof
                    let proof = yield inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "proof",
                            message: "Enter Merkle proof for group " + groupName + " separated by commas"
                        }
                    ]);
                    let proofArray = proof.proof.split(",");
                    merkleProof = proofArray.map((p) => Array.from(Buffer.from(p, 'hex')));
                    hashedAddress = Array.from(Buffer.from((0, sha3_1.keccak_256)(firstAccount.address)));
                }
                let spinner = (0, ora_1.default)("Minting NFT").start();
                const mintMsg = {
                    mint_native: {
                        collection,
                        group: groupName,
                        recipient: firstAccount.address,
                        merkle_proof: merkleProof,
                        hashed_address: hashedAddress
                    }
                };
                const coins = [{
                    denom: 'usei',
                    amount: new bignumber_js_1.default(group.unit_price).plus(new bignumber_js_1.default(lighthouseConfig.fee)).toString()
                }];
                const mintReceipt = yield client.execute(firstAccount.address, getLighthouseContract(config.network), mintMsg, "auto", "", coins);
                spinner.succeed("NFT minted");
                console.log("Transaction hash: " + chalk_1.default.green(mintReceipt.transactionHash));
                const events = mintReceipt.logs[0].events;
                let tokenId;
                // Find the event with the type 'wasm'
                for (const event of events) {
                    if (event.type === 'wasm') {
                        // Find the attribute with the key 'collection'
                        for (const attribute of event.attributes) {
                            if (attribute.key === 'token_id') {
                                tokenId = attribute.value;
                            }
                        }
                    }
                }
                console.log("Token ID: " + chalk_1.default.green(tokenId));
            }
        }));
    commander_1.program.parse();
};
const createDefaultConfig = () => {
    inquirer_1.default.prompt([
        {
            type: "input",
            name: "wallet",
            message: "What is the mnemonic keyphrase of the address you want to use in lighthouse?"
        },
        {
            type: "input",
            name: "count",
            message: "How many wallets will be used?"
        },
        {
            type: "input",
            name: "rpc",
            message: "What is the RPC you want to use"
        },
        {
            type: "list",
            name: "network",
            message: "What is the network you want to use? (pacific-1 is the mainnet, atlantic-2 is the testnet)",
            choices: ['pacific-1', 'atlantic-2']
        }
    ]).then((answers) => __awaiter(void 0, void 0, void 0, function* () {
        let config = {
            mnemonic: answers.wallet,
            rpc: answers.rpc,
            network: answers.network,
            count: answers.count
        };
        fs_1.default.writeFileSync("./config.json", JSON.stringify(config, null, 4));
        console.log(chalk_1.default.green("Created config.json"));
    }));
};
main();

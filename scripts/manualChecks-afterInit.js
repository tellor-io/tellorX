require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
const web3 = require("web3");
const h = require("../test/helpers/helpers");

// npx hardhat run scripts/manualChecks-afterInit.js --network rinkeby
// Note: add second address private key to .env file, TESTNET_PK2=""

// Update these variables before running script
const masterAddress = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
const controllerAddress = "0x45b778325ECf22E317767028a50749ff1D41E30b"
const oracleAddress = "0xD7b3529A008d1791Ea683b6Ac909ecE309603C12"
const governanceAddress = "0x8Db04961e0f87dE557aCB92f97d90e2A2840A468"
const treasuryAddress = "0x2fcAb47708fcE3713fD4420A0dDD5270b5b92632"
etherPrice = 4500000000
amplPrice = 1500000
expectedDisputeCount = 10

// Don't change these
let passCount = 0
let failCount = 0

async function manualChecks(_network, _pk, _pk2, _nodeURL) {
    await run("compile")
    await run("compile")

    var net = _network

    ///////////////Connect to the network
    let privateKey = _pk;
    let privateKey2 = _pk2;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL)
    let wallet = new ethers.Wallet(privateKey, provider)
    let wallet2 = new ethers.Wallet(privateKey2, provider)

    master = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", masterAddress)
    controller = await ethers.getContractAt("contracts/Controller.sol:Controller", controllerAddress)
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle", oracleAddress)
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance", governanceAddress)
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury", treasuryAddress)



    // *************************************
    // *
    // * After init()
    // *
    // *************************************
    console.log("\nAfter init checks:");

    // Pull old value
    console.log("\nPulling old value...");
    lastNewVal = await master.getLastNewValueById(1)
    verifyGreaterThan(lastNewVal[0], 0, "pull old value")

    // Add Tip to old ID's (AMPL, ETH/USD)
    console.log("\nAdding tip to old ID's (AMPL, ETH/USD)...");
    await oracle.connect(wallet).tipQuery(h.uintTob32(1), web3.utils.toWei("1"), "0x")
    await sleep(15000)
    verifyGreaterThanOrEqualTo(await oracle.getTipsById(h.uintTob32(1)), web3.utils.toWei("1"), "ETH/USD tips in contract")
    await oracle.connect(wallet).tipQuery(h.uintTob32(10), web3.utils.toWei("1"), "0x")
    await sleep(15000)
    verifyGreaterThanOrEqualTo(await oracle.getTipsById(h.uintTob32(10)), web3.utils.toWei("1"), "AMPL/USD tips in contract")

    // Mine AMPL/ ETH/USD
    console.log("\nMining AMPL/USD and ETH/USD...");
    await master.connect(wallet).transfer(wallet2.address, web3.utils.toWei("100"))
    await master.connect(wallet).depositStake()
    await sleep(15000)
    await master.connect(wallet2).depositStake()
    await sleep(15000)
    nonce = await oracle.getTimestampCountById(h.uintTob32(1))
    await oracle.connect(wallet).submitValue(h.uintTob32(1), etherPrice, nonce, "0x")
    nonce = await oracle.getTimestampCountById(h.uintTob32(10))
    await oracle.connect(wallet2).submitValue(h.uintTob32(10), amplPrice, nonce, "0x")
    await sleep(15000)

    // Read new values from old contract
    console.log("\nReading new values from old contract...");
    lastNewValEth = await master.getLastNewValueById(1)
    verifyEquals(lastNewValEth[0], etherPrice, "Mine & read ETH/USD")
    lastNewValAmpl = await master.getLastNewValueById(10)
    verifyEquals(lastNewValAmpl[0], amplPrice, "Mine & read AMPL/USD")

    // Ensure no disputes for next week on previous submissions (old stuff)
    console.log("\nEnsuring no disputes on previous submissions (old stuff)...");
    verifyEquals(await master.getUintVar(h.hash("_DISPUTE_COUNT")), expectedDisputeCount, "No disputes on old stuff")
    console.log("Keep checking for new disputes on old values for one week");

    // transfer
    console.log("\nTransferring TRB...");
    bal0 = await master.balanceOf(wallet2.address)
    await master.connect(wallet).transfer(wallet2.address, web3.utils.toWei("1"))
    await sleep(15000)
    bal1 = await master.balanceOf(wallet2.address)
    verifyEquals(bal1.sub(bal0), web3.utils.toWei("1"), "TRB transfer")

    // approve a token
    console.log("\nApproving a token...");
    await master.connect(wallet).approve(wallet2.address, web3.utils.toWei("10"))
    await sleep(15000)
    verifyEquals(await master.allowance(wallet.address, wallet2.address), web3.utils.toWei("10"), "token approval")
    await master.connect(wallet2).transferFrom(wallet.address, wallet2.address, web3.utils.toWei("10"))
    await sleep(15000)
    bal2 = await master.balanceOf(wallet2.address)
    verifyEquals(bal2.sub(bal1), web3.utils.toWei("10"), "TRB transfer")

    console.log("\n" + passCount + "/" + (passCount+failCount) + " checks passed");
}

function verifyEquals(firstVal, secondVal, name) {
  if(firstVal == secondVal) {
    console.log(name + " " + "passes");
    passCount++
  } else {
    console.log(name + " " + "fails. expected:" + secondVal + " actual:" + firstVal);
    failCount++
  }
}

function verifyGreaterThan(firstVal, secondVal, name) {
  if(firstVal > secondVal) {
    console.log(name + " " + "passes");
    passCount++
  } else {
    console.log(name + " " + "fails. expected greater than:" + secondVal + " actual:" + firstVal);
    failCount++
  }
}

function verifyGreaterThanOrEqualTo(firstVal, secondVal, name) {
  if(firstVal >= secondVal) {
    console.log(name + " " + "passes");
    passCount++
  } else {
    console.log(name + " " + "fails. expected greater than or equal to:" + secondVal + " actual:" + firstVal);
    failCount++
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

manualChecks("rinkeby", process.env.TESTNET_PK, process.env.TESTNET_PK2, process.env.NODE_URL_RINKEBY)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

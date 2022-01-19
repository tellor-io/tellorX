require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
const web3 = require('web3');
var fs = require('fs');

//const dotenv = require('dotenv').config()
//npx hardhat run scripts/TreasuryVote.js --network rinkeby
// const masterAddress = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
// const controllerAddress = "0x45b778325ECf22E317767028a50749ff1D41E30b"
// const oracleAddress = "0xD7b3529A008d1791Ea683b6Ac909ecE309603C12"
// const governanceAddress = "0x8Db04961e0f87dE557aCB92f97d90e2A2840A468"
// const treasuryAddress = "0x2fcAb47708fcE3713fD4420A0dDD5270b5b92632"

const masterAddress = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
const controllerAddress = "0xf98624E9924CAA2cbD21cC6288215Ec2ef7cFE80"
const oracleAddress = "0xe8218cACb0a5421BC6409e498d9f8CC8869945ea"
const governanceAddress = "0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00"
const treasuryAddress = "0x3b0f3eaEFaAc9f8F7FDe406919ecEb5270fE0607"

//npx hardhat run scripts/TreasuryVote.js --network mainnet

// TellorX Governance	0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00
// TellorX Oracle	0xe8218cACb0a5421BC6409e498d9f8CC8869945ea
// TellorX Treasury	0x3b0f3eaEFaAc9f8F7FDe406919ecEb5270fE0607
// TellorX Controller	0xf98624E9924CAA2cbD21cC6288215Ec2ef7cFE80

async function propTreasuryVote( _network, _pk, _nodeURL) {

    await run("compile")
    var net = _network

    if (net == "mainnet") {
        etherscanUrl= "https://etherscan.io"
      } else if (net == "rinkeby") {
        etherscanUrl= "https://rinkeby.etherscan.io"
      }


    ///////////////Connect to the network
    let privateKey = _pk;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL) 
    let wallet = new ethers.Wallet(privateKey, provider);

    let gov = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", governanceAddress)
    let blocky = await ethers.provider.getBlock();

    //Use this, it has no function byte code--Like the tests!!    
    let vars = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256'], [web3.utils.toWei("100000"),250,7776000])
    console.log("vars",treasuryAddress,"0x6274885f", vars,blocky.timestamp+86400*7 )

    //Propose treasury
    let proposeTreas = await gov.connect(wallet).proposeVote(treasuryAddress,0x6274885f,vars,blocky.timestamp)
    console.log("propose tx")
    var link = "".concat(etherscanUrl, '/tx/', proposeTreas.hash)
                console.log("Hash link: ", link)
                console.log('Waiting for the transaction to be mined');
                await proposeTreas.wait() // If there's an out of gas error the second parameter is the receipt.

    //vote on treasury with multis
    //get 5% quorum
    //vote from multis

    //tallyvotes
    //await gov.connect(wallet).tallyVotes(n)

    //execute
    //await gov.connect(wallet).executeVote(n)

    //buyTreasury(uint256 _id, uint256 _amount)

    //payTreasury
    //payTreasury(address _investor, uint256 _id)

    //check amount paid is correct
    //getTreasuryAccount(uint256 _id, address _investor)


}

propTreasuryVote("mainnet", process.env.PRIVATE_KEY, process.env.NODE_URL_MAINNET)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
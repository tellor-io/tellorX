require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
const web3 = require('web3');

// npx hardhat run scripts/initTellorx.js --network goerli



//goerli 
tellorMaster = '0x51c59c6cAd28ce3693977F2feB4CfAebec30d8a2'

async function runInit(_network, _pk, _nodeURL) {
    console.log("oldTellor")
    await run("compile")

    var net = _network

    ///////////////Connect to the network
    let privateKey = _pk;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL)
    let wallet = new ethers.Wallet(privateKey, provider)

    ////////////// Deploy tellor

         //////////////// extension
         
         const oracle = await ethers.getContractAt("contracts/Controller.sol:Controller",tellorMaster)
         await oracle.connect(wallet).init()

}

runInit("goerli", process.env.TESTNET_PK, process.env.NODE_URL_GOERLI)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
         


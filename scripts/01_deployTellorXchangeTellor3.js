//require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

//const dotenv = require('dotenv').config()
//npx hardhat run scripts/01_deployTellorXchangeTellor3.js --network sepolia

var tellormaster = '0x80fc34a2f9FfE86F41580F47368289C402DEc660'

async function deployTellorx() {
    console.log("deploy tellor 3")
    await run("compile")

    var net = hre.network.name

    try {
        if (net == "sepolia") {
            var network = "sepolia"
            var explorerUrl = "https://sepolia.etherscan.io/address/"
            var pubAddr = process.env.TESTNET_PUBLIC
            var privateKey = process.env.TESTNET_PK
            var provider = new ethers.providers.JsonRpcProvider(process.env.NODE_URL_SEPOLIA)
            var wallet = await new ethers.Wallet(privateKey, provider)
        }
      } catch (error) {
        console.error(error)
        console.log("network error or environment not defined")
        process.exit(1)
    }
      console.log(network, pubAddr)


    ///////////////Connect to the network
   
    /////////// Deploy Tellor X
    console.log("deploy tellor X")

    ////////////////Governance
    console.log("Starting deployment for governance contract...")
    const gfac = await ethers.getContractFactory("Governance", wallet)
     const governance = await gfac.deploy({gasLimit: 8000000})
    console.log("Governance contract deployed to: ", governance.address)

    await governance.deployed()
    console.log("Governance contract deployed to:", explorerUrl  + governance.address);


    /////////////Oracle
    console.log("Starting deployment for Oracle contract...")
    const ofac = await ethers.getContractFactory("Oracle", wallet)
    const oracle = await ofac.deploy({gasLimit: 8000000})
    await oracle.deployed();

    console.log("oracle contract deployed to:", explorerUrl + oracle.address);

    ///////////Treasury
    console.log("Starting deployment for Treasury contract...")
    const tfac = await ethers.getContractFactory("Treasury", wallet)
    const treasury = await tfac.deploy({gasLimit: 8000000})
    await treasury.deployed()
    console.log("treasury contract deployed to:", explorerUrl  + treasury.address);


    //////////////Controler
    console.log("Starting deployment for Controller contract...")
    const cfac = await ethers.getContractFactory("Controller", wallet)
    const controller = await cfac.deploy(governance.address, oracle.address, treasury.address, {gasLimit: 8000000})
    await controller.deployed()

    console.log("The controller contract was deployed to:", explorerUrl  + controller.address);


    tellorMaster = await ethers.getContractAt("contracts/tellor3/TellorMaster", tellormaster)
    await master.connect(wallet).changeTellorContract(controller.address, {gasLimit: 3000000})
    tellorNew = await ethers.getContractAt("contracts/Controller.sol:Controller", tellormaster)
    await tellorNew.connect(wallet).init({gasLimit: 3000000})

  
    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for tx confirmation...');
    await controller.deployTransaction.wait(7)

    console.log('submitting contract for verification...');

    try {
    await run("verify:verify",
        {
            address: controller.address,
            constructorArguments: [governance.address, oracle.address, treasury.address]
        },
    )
    console.log("Controller contract verified")
    } catch (e) {
    console.log(e)
    }

  
 
    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for governance tx confirmation...');
    await governance.deployTransaction.wait(7)

    console.log('submitting governance contract for verification...');
    try{
    await run("verify:verify",
        {
            address: governance.address,
        },
    )
    console.log("governance contract verified")
    } catch (e) {
    console.log(e)
    }
    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for treasury tx confirmation...');
    await treasury.deployTransaction.wait(7)

    console.log('submitting Treasury contract for verification...');
    try{
    await run("verify:verify", {
        address: treasury.address,
    },
    )
    console.log("treasury contract verified")
    } catch (e) {
    console.log(e)
    }

    console.log('waiting for Oracle tx confirmation...');
    await oracle.deployTransaction.wait(7)

    console.log('submitting Oracle contract for verification...');
    try {
    await run("verify:verify",
        {
            address: oracle.address,
        },
    )
    console.log("Oracle contract verified")
    } catch (e) {
    console.log(e)
    }

}


deployTellorx()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

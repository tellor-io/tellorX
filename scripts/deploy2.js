//require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

//const dotenv = require('dotenv').config()
//npx hardhat run scripts/deploy.js --network rinkeby

async function deployTellorx(_network, _pk, _nodeURL) {
    console.log("deploy tellor 3")
    await run("compile")

    await run("compile")


    var net = _network


    ///////////////Connect to the network
    let privateKey = _pk;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL)
    let wallet = new ethers.Wallet(privateKey, provider)


    ////////////// Deploy Tellor 3

    //////////////// Extension
    console.log("Starting deployment for extension contract...")
    const extfac = await ethers.getContractFactory("contracts/tellor3/Extension.sol:Extension", wallet)
    const extfacwithsigner = await extfac.connect(wallet)
    const extension = await extfac.deploy()
    console.log("Extension contract deployed to: ", extension.address)

    await extension.deployed()

    if (net == "mainnet") {
        console.log("Extension contract deployed to:", "https://etherscan.io/address/" + extension.address);
        console.log("   Extension transaction hash:", "https://etherscan.io/tx/" + extension.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("Extension contract deployed to:", "https://rinkeby.etherscan.io/address/" + extension.address);
        console.log("    Extension transaction hash:", "https://rinkeby.etherscan.io/tx/" + extension.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }




    //////////////// Tellor (Test)
    console.log("Starting deployment for tellor contract...")
    const telfac = await ethers.getContractFactory("contracts/tellor3/Mocks/TellorTest.sol:TellorTest", wallet)
    const telfacwithsigner = await telfac.connect(wallet)
    const tellor = await telfac.deploy(extension.address)
    console.log("Tellor contract deployed to: ", tellor.address)

    await tellor.deployed()

    if (net == "mainnet") {
        console.log("Tellor contract deployed to:", "https://etherscan.io/address/" + tellor.address);
        console.log("   Tellor transaction hash:", "https://etherscan.io/tx/" + tellor.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("Tellor contract deployed to:", "https://rinkeby.etherscan.io/address/" + tellor.address);
        console.log("    Tellor transaction hash:", "https://rinkeby.etherscan.io/tx/" + tellor.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }


    //////////////// Master
    console.log("Starting deployment for master contract...")
    const masfac = await ethers.getContractFactory("contracts/tellor3/TellorMaster.sol:TellorMaster", wallet)
    const masfacwithsigner = await masfac.connect(wallet)
    const master = await masfac.deploy(tellor.address, tellor.address) // use same addr for _OLD_TELLOR and _newTellor?
    console.log("Master contract deployed to: ", master.address)

    await master.deployed()

    if (net == "mainnet") {
        console.log("Master contract deployed to:", "https://etherscan.io/address/" + master.address);
        console.log("   Master transaction hash:", "https://etherscan.io/tx/" + master.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("Master contract deployed to:", "https://rinkeby.etherscan.io/address/" + master.address);
        console.log("    Master transaction hash:", "https://rinkeby.etherscan.io/tx/" + master.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }


    /////////// Deploy Tellor X
    console.log("deploy tellor X")

    ////////////////Governance
    console.log("Starting deployment for governance contract...")
    const gfac = await ethers.getContractFactory("contracts/Governance.sol:Governance", wallet)
    const gfacwithsigner = await gfac.connect(wallet)
    const governance = await gfacwithsigner.deploy(master.address)
    console.log("Governance contract deployed to: ", governance.address)

    await governance.deployed()

    if (net == "mainnet") {
        console.log("Governance contract deployed to:", "https://etherscan.io/address/" + governance.address);
        console.log("   Governance transaction hash:", "https://etherscan.io/tx/" + governance.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("Governance contract deployed to:", "https://rinkeby.etherscan.io/address/" + governance.address);
        console.log("    Governance transaction hash:", "https://rinkeby.etherscan.io/tx/" + governance.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }


    /////////////Oracle
    console.log("Starting deployment for Oracle contract...")
    const ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle", wallet)
    const ofacwithsigner = await ofac.connect(wallet)
    const oracle = await ofacwithsigner.deploy(master.address)
    await oracle.deployed();


    if (net == "mainnet") {
        console.log("oracle contract deployed to:", "https://etherscan.io/address/" + oracle.address);
        console.log("    oracle transaction hash:", "https://etherscan.io/tx/" + oracle.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("oracle contract deployed to:", "https://rinkeby.etherscan.io/address/" + oracle.address);
        console.log("    oracle transaction hash:", "https://rinkeby.etherscan.io/tx/" + oracle.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }

    ///////////Treasury
    console.log("Starting deployment for Treasury contract...")
    const tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury", wallet)
    const tfacwithsigner = await tfac.connect(wallet)
    const treasury = await tfacwithsigner.deploy(master.address)
    await treasury.deployed()

    if (net == "mainnet") {
        console.log("treasury contract deployed to:", "https://etherscan.io/address/" + treasury.address);
        console.log("    treasury transaction hash:", "https://etherscan.io/tx/" + treasury.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("treasury contract deployed to:", "https://rinkeby.etherscan.io/address/" + treasury.address);
        console.log("    treasury transaction hash:", "https://rinkeby.etherscan.io/tx/" + treasury.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }

    console.log("treasury Contract verified")

    //////////////Controler
    console.log("Starting deployment for Controller contract...")
    const cfac = await ethers.getContractFactory("contracts/Controller.sol:Controller", wallet)
    const cfacwithsigners = await cfac.connect(wallet)
    const controller = await cfacwithsigners.deploy(governance.address, oracle.address, treasury.address)
    await controller.deployed()

    if (net == "mainnet") {
        console.log("The controller contract was deployed to:", "https://etherscan.io/address/" + controller.address);
        console.log("    transaction hash:", "https://etherscan.io/tx/" + controller.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("The controller contract was deployed to:", "https://rinkeby.etherscan.io/address/" + controller.address);
        console.log("    transaction hash:", "https://rinkeby.etherscan.io/tx/" + controller.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }

    tellorTest = await ethers.getContractAt("contracts/tellor3/Mocks/TellorTest.sol:TellorTest", master.address)
    await tellorTest.connect(wallet).setBalanceTest(wallet.address, ethers.BigNumber.from("1000000000000000000000000"))
    await tellorTest.connect(wallet).changeOracleContract(oracle.address)
    await tellorTest.connect(wallet).changeGovernanceContract(governance.address)

    await master.connect(wallet).changeTellorContract(controller.address)
    tellorNew = await ethers.getContractAt("contracts/Controller.sol:Controller", master.address)
    await tellorNew.connect(wallet).init()


    console.log("TellorX deployed! You have 1 million test TRB in your wallet.")

    console.log('submitting extension contract for verification...');
    await run("verify:verify",
        {
            address: extension.address,
        },
    )
    console.log("extension contract verified")

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for tx confirmation...');
    await controller.deployTransaction.wait(7)

    console.log('submitting contract for verification...');

    await run("verify:verify",
        {
            address: controller.address,
            constructorArguments: [governance.address, oracle.address, treasury.address]
        },
    )
    console.log("Controller contract verified")


    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for tellor tx confirmation...');
    await tellor.deployTransaction.wait(7)

    console.log('submitting tellor contract for verification...');
    await run("verify:verify",
        {
            address: tellor.address,
            constructorArguments: [extension.address]
        },
    )
    console.log("tellor contract verified")

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for master tx confirmation...');
    await master.deployTransaction.wait(7)

    console.log('submitting master contract for verification...');
    await run("verify:verify",
        {
            address: master.address,
            constructorArguments: [tellor.address, tellor.address]
        },
    )
    console.log("master contract verified")

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for governance tx confirmation...');
    await governance.deployTransaction.wait(7)

    console.log('submitting governance contract for verification...');
    await run("verify:verify",
        {
            address: governance.address,
            constructorArguments: [master.address]
        },
    )
    console.log("governance contract verified")

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for treasury tx confirmation...');
    await treasury.deployTransaction.wait(7)

    console.log('submitting Treasury contract for verification...');

    await run("verify:verify", {
        address: treasury.address,
        constructorArguments: [master.address]
    },
    )

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for Oracle tx confirmation...');
    await oracle.deployTransaction.wait(7)

    console.log('submitting Oracle contract for verification...');

    await run("verify:verify",
        {
            address: oracle.address,
            constructorArguments: [master.address]
        },
    )

    console.log("Oracle contract verified")

}


deployTellorx("rinkeby", process.env.TESTNET_PK, process.env.NODE_URL_RINKEBY)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

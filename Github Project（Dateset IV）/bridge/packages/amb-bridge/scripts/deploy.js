const hre = require("hardhat")
const fs = require("fs");

const owner = {
    home: process.env.HOME_OWNER,
    foreign: process.env.FOREIGN_OWNER
}

const chainIds = {
    home: process.env.HOME_CHAINID,
    foreign: process.env.FOREIGN_CHAINID
}

async function main() {

    const EternalStorageProxy = await hre.ethers.getContractFactory("EternalStorageProxy")
    const BridgeValidators = await hre.ethers.getContractFactory("BridgeValidators")
    const HomeAMB = await hre.ethers.getContractFactory("HomeAMB")
    const ForeignAMB = await hre.ethers.getContractFactory("ForeignAMB")

    console.log("==> Deploying contracts for:", hre.network.name.toUpperCase())
    const home = hre.network.name === "home"
    const net = home ? "home" : "foreign"

    console.log("==> Deploying storage for "  + net + " validators")
    const storageValidators = await EternalStorageProxy.deploy()
    await storageValidators.deployed()

    console.log("==> Deploying " + net + " bridge validators implementation")
    const bridgeValidators = await BridgeValidators.deploy()
    await bridgeValidators.deployed()

    console.log("==> Hook up eternal storage to BridgeValidators")
    let tx = await storageValidators.upgradeTo("1", bridgeValidators.address)
    await tx.wait()

    console.log("==> Initialize " + net + " bridge validators")
    const required = process.env.VALIDATORS_REQUIRED
    const validators = process.env.VALIDATORS.split(",")
    const bridgeValidatorsProxyAccess = BridgeValidators.attach(storageValidators.address)
    tx = await bridgeValidatorsProxyAccess.initialize(required, validators, owner[net])
    await tx.wait()

    console.log("==> Transfer bridge validators ownership")
    tx = await storageValidators.transferProxyOwnership(owner[net])
    await tx.wait()

    console.log("==> Deploying storage for " + net + " AM bridge")
    const storageBridge = await EternalStorageProxy.deploy()
    await storageBridge.deployed()

    console.log("==> Deploying " + net + " AM bridge implementation")
    let amb;
    if (home) {
        amb = await HomeAMB.deploy()
    } else {
        amb = await ForeignAMB.deploy()
    }
    await amb.deployed()

    console.log("==> Hook up eternal storage to AMBridge")
    tx = await storageBridge.upgradeTo("1", amb.address)
    await tx.wait()

    console.log("==> Initialize " + net + " AMBridge")
    let ambStorageAccess;
    if (home) {
        ambStorageAccess = await HomeAMB.attach(storageBridge.address)
    } else {
        ambStorageAccess = await ForeignAMB.attach(storageBridge.address)
    }
    tx = await ambStorageAccess.initialize(
        home ? chainIds.home : chainIds.foreign,
        home ? chainIds.foreign : chainIds.home,
        bridgeValidatorsProxyAccess.address,
        "20000000",
        home ? process.env.HOME_GAS_PRICE : process.env.FOREIGN_GAS_PRICE,
        "12",
        owner[net]
    )
    await tx.wait()

    console.log("==> Transfer " + net + " AMBridge ownership")
    tx = await storageBridge.transferProxyOwnership(owner[net])
    await tx.wait()

    console.log("==> Finished " + net.toUpperCase() + " AMB deployment")

    console.log("\n")
    console.log(net.toUpperCase(), "Bridge Validators:     ", storageValidators.address)
    console.log(net.toUpperCase(), "AMBridge:              ", storageBridge.address)
    console.log("\n")

    if (home) {
        await fs.writeFileSync('home_amb_deployment.json', JSON.stringify({validators: storageValidators.address, bridge: storageBridge.address}))
    } else {
        await fs.writeFileSync('foreign_amb_deployment.json', JSON.stringify({validators: storageValidators.address, bridge: storageBridge.address}))
    }
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
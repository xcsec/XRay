module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // only deploy to Kovan testnet
  if (network.name == 'kovan') {
    // this is the Optimism L1StandardBridge address in Kovan
    let bridge = '0x22F24361D548e5FaAfb36d1437839f080363982B';

    await deploy('SenderOptimismL1', {
      from: deployer,
      log: true,
      args: [bridge],
    });
  }
};

module.exports.tags = ['sender_optimism_l1'];

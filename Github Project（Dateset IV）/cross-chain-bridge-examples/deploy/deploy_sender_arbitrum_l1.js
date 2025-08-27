module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // only deploy to Rinkeby testnet
  if (network.name == 'rinkeby') {
    // this is the Arbitrum Bridge address in Rinkeby
    let bridge = '0x9a28e783c47bbeb813f32b861a431d0776681e95';

    await deploy('SenderArbitrumL1', {
      from: deployer,
      log: true,
      args: [bridge],
    });
  }
};

module.exports.tags = ['sender_arbitrum_l1'];

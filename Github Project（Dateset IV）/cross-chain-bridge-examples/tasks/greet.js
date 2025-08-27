task('greet', 'Gets the greet from the Greeter deployed in the selected network.').setAction(async (taskArgs) => {
  const greeter = await ethers.getContract('Greeter');

  const greet = await greeter.greet();

  console.log('The Greeter says: ' + greet);
});

task('greet:optimism-l2', 'Gets the greet from the GreeterOptimismL2').setAction(async (taskArgs) => {
  const greeter = await ethers.getContract('GreeterOptimismL2');

  const greet = await greeter.greet();

  console.log('The Greeter says: ' + greet);
});

task('set-greeting:optimism-l2', 'Tries to set the greeting directly').setAction(async (taskArgs) => {
  const greeter = await ethers.getContract('GreeterOptimismL2');

  const greet = await greeter.setGreeting('Must fail');
});

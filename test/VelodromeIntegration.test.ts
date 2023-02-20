import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { addresses, velodromePools } from "./constants";
import {
  approve,
  getBalance,
  getOneInchApiResponse,
  WETHContractAddress,
  wrapEther,
} from "./helpers";

describe("VelodromeIntegration", function () {
  async function deployVelodromeIntegration() {
    const [deployer, otherAccount] = await ethers.getSigners();

    const goodwill = 0;
    const affiliateSplit = 0;

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy();

    const VelodromeIntegration = await ethers.getContractFactory(
      "contracts/VelodromeIntegration.sol:VelodromeIntegration"
    );
    const velodromeIntegration = await VelodromeIntegration.deploy(
      goodwill,
      affiliateSplit,
      vault.address
    );

    return {
      deployer,
      otherAccount,
      vault,
      goodwill,
      affiliateSplit,
      velodromeIntegration,
    };
  }

  describe("Deposits", () => {
    describe("Deposits in ETH", () => {
      it("Should deposit ETH to WETH-USDC pool. [ETH - WETH - WETH-USDC]", async () => {
        const { otherAccount, velodromeIntegration, goodwill } =
          await loadFixture(deployVelodromeIntegration);

        const entryTokenAddress = addresses.ETH;
        const entryTokenAmount = ethers.utils.parseEther("10");

        const poolAddress = velodromePools.WETH_USDC;
        const depositTokenAddress = addresses.USDC;
        const minExitTokenAmount = 0;
        const underlyingTarget = addresses.ZERO_ADDRESS;
        const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
        const swapTarget = addresses.ONE_INCH;
        const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

        const swapTargetApiResponse = await getOneInchApiResponse(
          ethers.provider.network.chainId,
          entryTokenAddress,
          entryTokenAmount.sub(goodwillPortion),
          depositTokenAddress,
          velodromeIntegration.address
        );

        const swapData = swapTargetApiResponse.tx.data;
        const affiliate = addresses.ZERO_ADDRESS;

        console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);

        await expect(
          velodromeIntegration
            .connect(otherAccount)
            .deposit(
              entryTokenAddress,
              entryTokenAmount,
              poolAddress,
              depositTokenAddress,
              minExitTokenAmount,
              underlyingTarget,
              targetDepositTokenAddress,
              swapTarget,
              swapData,
              affiliate,
              { value: entryTokenAmount }
            )
        ).to.be.fulfilled;

        console.log(`...done`);
        console.log(
          "WETH LEFT: ",
          await getBalance(addresses.WETH, velodromeIntegration.address)
        );
        console.log(
          "ETH LEFT: ",
          await ethers.provider.getBalance(velodromeIntegration.address)
        );
        console.log(
          "USDC LEFT: ",
          await getBalance(addresses.USDC, velodromeIntegration.address)
        );
      });

      it("Should deposit ETH to USDC_DAI pool. [ETH - DAI - USDC-DAI]", async () => {
        const { otherAccount, velodromeIntegration, goodwill } =
          await loadFixture(deployVelodromeIntegration);

        const entryTokenAddress = addresses.ETH;
        const entryTokenAmount = ethers.utils.parseEther("10");

        const poolAddress = velodromePools.USDC_DAI;
        const depositTokenAddress = addresses.USDC;
        const minExitTokenAmount = 0;
        const underlyingTarget = addresses.ZERO_ADDRESS;
        const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
        const swapTarget = addresses.ONE_INCH;
        const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

        const swapTargetApiResponse = await getOneInchApiResponse(
          ethers.provider.network.chainId,
          entryTokenAddress,
          entryTokenAmount.sub(goodwillPortion),
          depositTokenAddress,
          velodromeIntegration.address
        );

        const swapData = swapTargetApiResponse.tx.data;
        const affiliate = addresses.ZERO_ADDRESS;

        console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);

        await expect(
          velodromeIntegration
            .connect(otherAccount)
            .deposit(
              entryTokenAddress,
              entryTokenAmount,
              poolAddress,
              depositTokenAddress,
              minExitTokenAmount,
              underlyingTarget,
              targetDepositTokenAddress,
              swapTarget,
              swapData,
              affiliate,
              { value: entryTokenAmount }
            )
        ).to.be.fulfilled;

        console.log(`...done`);
        console.log(
          "DAI LEFT: ",
          await getBalance(addresses.DAI, velodromeIntegration.address)
        );
        console.log(
          "ETH LEFT: ",
          await ethers.provider.getBalance(velodromeIntegration.address)
        );
        console.log(
          "USDC LEFT: ",
          await getBalance(addresses.USDC, velodromeIntegration.address)
        );
        console.log("LIQUIDITY PROVIDED: ", await getBalance(poolAddress, otherAccount.address));
        
      });
    });

    describe("Deposits in ERC20", () => {
      it("Should deposit DAI to WETH-USDC pool. [DAI - WETH - WETH-USDC]", async () => {
        const { otherAccount, velodromeIntegration, goodwill } =
          await loadFixture(deployVelodromeIntegration);

        const swapDataX = await getOneInchApiResponse(
          ethers.provider.network.chainId,
          addresses.ETH,
          ethers.utils.parseEther("10"),
          addresses.DAI,
          otherAccount.address
        );

        const unsignedTransaction = {
          from: otherAccount.address,
          to: addresses.ONE_INCH,
          data: swapDataX.tx.data,
          value: ethers.utils.parseEther("10"),
        };

        await otherAccount.sendTransaction(unsignedTransaction);

        const entryTokenAddress = addresses.DAI;
        const entryTokenAmount = await velodromeIntegration.getBalance(
          addresses.DAI,
          otherAccount.address
        );

        const poolAddress = velodromePools.WETH_USDC;
        const depositTokenAddress = addresses.USDC;
        const minExitTokenAmount = 0;
        const underlyingTarget = addresses.ZERO_ADDRESS;
        const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
        const swapTarget = addresses.ONE_INCH;
        const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

        const swapTargetApiResponse = await getOneInchApiResponse(
          ethers.provider.network.chainId,
          entryTokenAddress,
          entryTokenAmount.sub(goodwillPortion),
          depositTokenAddress,
          velodromeIntegration.address
        );

        const swapData = swapTargetApiResponse.tx.data;
        const affiliate = addresses.ZERO_ADDRESS;

        await approve(
          otherAccount,
          addresses.DAI,
          velodromeIntegration.address,
          entryTokenAmount
        );

        console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);

        await expect(
          velodromeIntegration
            .connect(otherAccount)
            .deposit(
              entryTokenAddress,
              entryTokenAmount,
              poolAddress,
              depositTokenAddress,
              minExitTokenAmount,
              underlyingTarget,
              targetDepositTokenAddress,
              swapTarget,
              swapData,
              affiliate
            )
        ).to.be.fulfilled;

        console.log(`...done`);
        console.log(
          "WETH LEFT: ",
          await getBalance(addresses.WETH, velodromeIntegration.address)
        );
        console.log(
          "ETH LEFT: ",
          await ethers.provider.getBalance(velodromeIntegration.address)
        );
        console.log(
          "USDC LEFT: ",
          await getBalance(addresses.USDC, velodromeIntegration.address)
        );
        console.log(
          "DAI LEFT: ",
          await getBalance(addresses.DAI, velodromeIntegration.address)
        );
      });
    });

    describe("Withdrawals", () => {
      describe("Withdrawals in ETH", () => {});
      it("Should deposit with DAI to WETH-USDC pool, withdraw, and get correct amount of ETH.", async () => {
        const { otherAccount, velodromeIntegration, goodwill } =
          await loadFixture(deployVelodromeIntegration);

        {
          // Deposit
          const swapDataX = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            addresses.ETH,
            ethers.utils.parseEther("10"),
            addresses.DAI,
            otherAccount.address
          );

          const unsignedTransaction = {
            from: otherAccount.address,
            to: addresses.ONE_INCH,
            data: swapDataX.tx.data,
            value: ethers.utils.parseEther("10"),
          };

          await otherAccount.sendTransaction(unsignedTransaction);

          const entryTokenAddress = addresses.DAI;
          const entryTokenAmount = await velodromeIntegration.getBalance(
            addresses.DAI,
            otherAccount.address
          );

          const poolAddress = velodromePools.WETH_USDC;
          const depositTokenAddress = addresses.USDC;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
          const swapTarget = addresses.ONE_INCH;
          const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            entryTokenAddress,
            entryTokenAmount.sub(goodwillPortion),
            depositTokenAddress,
            velodromeIntegration.address
          );

          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            addresses.DAI,
            velodromeIntegration.address,
            entryTokenAmount
          );

          console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);

          await expect(
            velodromeIntegration
              .connect(otherAccount)
              .deposit(
                entryTokenAddress,
                entryTokenAmount,
                poolAddress,
                depositTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetDepositTokenAddress,
                swapTarget,
                swapData,
                affiliate
              )
          ).to.be.fulfilled;

          console.log(`...done`);
          console.log(
            "WETH LEFT: ",
            await getBalance(addresses.WETH, velodromeIntegration.address)
          );
          console.log(
            "USDT LEFT: ",
            await getBalance(addresses.USDT, velodromeIntegration.address)
          );
          console.log(
            "USDC LEFT: ",
            await getBalance(addresses.USDC, velodromeIntegration.address)
          );
          console.log(
            "DAI LEFT: ",
            await getBalance(addresses.DAI, velodromeIntegration.address)
          );
        }

        {
          // Withdraw
          const poolAddress = velodromePools.WETH_USDC;
          const liquidityAmount = await velodromeIntegration.getBalance(
            poolAddress,
            otherAccount.address
          );
          const exitTokenAddress = addresses.ETH;
          const minExitTokenAmount = 0;
          const underlyingTarget = addresses.ZERO_ADDRESS;
          const targetWithdrawTokenAddress = addresses.USDC;
          const swapTarget = addresses.ONE_INCH;
          const underlyingReturnAmount =
            await velodromeIntegration.removeAssetReturn(
              poolAddress,
              targetWithdrawTokenAddress,
              liquidityAmount
            );
          console.log(underlyingReturnAmount.toString());

          const swapTargetApiResponse = await getOneInchApiResponse(
            ethers.provider.network.chainId,
            targetWithdrawTokenAddress,
            underlyingReturnAmount,
            exitTokenAddress,
            velodromeIntegration.address
          );
          const swapData = swapTargetApiResponse.tx.data;
          const affiliate = addresses.ZERO_ADDRESS;

          await approve(
            otherAccount,
            poolAddress,
            velodromeIntegration.address,
            liquidityAmount
          );

          console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);

          await velodromeIntegration
            .connect(otherAccount)
            .withdraw(
              poolAddress,
              liquidityAmount,
              exitTokenAddress,
              minExitTokenAmount,
              underlyingTarget,
              targetWithdrawTokenAddress,
              swapTarget,
              swapData,
              affiliate
            );

          console.log(
            "WETH LEFT: ",
            await getBalance(addresses.WETH, velodromeIntegration.address)
          );
          console.log(
            "USDT LEFT: ",
            await getBalance(addresses.USDT, velodromeIntegration.address)
          );
          console.log(
            "USDC LEFT: ",
            await getBalance(addresses.USDC, velodromeIntegration.address)
          );
          console.log(
            "DAI LEFT: ",
            await getBalance(addresses.DAI, velodromeIntegration.address)
          );
          console.log(
            "ETH LEFT: ",
            await ethers.provider.getBalance(velodromeIntegration.address)
          );

          console.log(
            "ETH GOT AFTER WITHDRAW: ",
            await ethers.provider.getBalance(otherAccount.address)
          );

          console.log(`...done`);
        }
      });
      describe("Withdrawals in ERC20", () => {
        it("Should deposit with DAI to WETH-USDC pool, withdraw, and get correct amount of USDT.", async () => {
          const { otherAccount, velodromeIntegration, goodwill } =
            await loadFixture(deployVelodromeIntegration);

          {
            // Deposit
            const swapDataX = await getOneInchApiResponse(
              ethers.provider.network.chainId,
              addresses.ETH,
              ethers.utils.parseEther("10"),
              addresses.DAI,
              otherAccount.address
            );

            const unsignedTransaction = {
              from: otherAccount.address,
              to: addresses.ONE_INCH,
              data: swapDataX.tx.data,
              value: ethers.utils.parseEther("10"),
            };

            await otherAccount.sendTransaction(unsignedTransaction);

            const entryTokenAddress = addresses.DAI;
            const entryTokenAmount = await velodromeIntegration.getBalance(
              addresses.DAI,
              otherAccount.address
            );

            const poolAddress = velodromePools.WETH_USDC;
            const depositTokenAddress = addresses.USDC;
            const minExitTokenAmount = 0;
            const underlyingTarget = addresses.ZERO_ADDRESS;
            const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
            const swapTarget = addresses.ONE_INCH;
            const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

            const swapTargetApiResponse = await getOneInchApiResponse(
              ethers.provider.network.chainId,
              entryTokenAddress,
              entryTokenAmount.sub(goodwillPortion),
              depositTokenAddress,
              velodromeIntegration.address
            );

            const swapData = swapTargetApiResponse.tx.data;
            const affiliate = addresses.ZERO_ADDRESS;

            await approve(
              otherAccount,
              addresses.DAI,
              velodromeIntegration.address,
              entryTokenAmount
            );

            console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);

            await expect(
              velodromeIntegration
                .connect(otherAccount)
                .deposit(
                  entryTokenAddress,
                  entryTokenAmount,
                  poolAddress,
                  depositTokenAddress,
                  minExitTokenAmount,
                  underlyingTarget,
                  targetDepositTokenAddress,
                  swapTarget,
                  swapData,
                  affiliate
                )
            ).to.be.fulfilled;

            console.log(`...done`);
            console.log(
              "WETH LEFT: ",
              await getBalance(addresses.WETH, velodromeIntegration.address)
            );
            console.log(
              "USDT LEFT: ",
              await getBalance(addresses.USDT, velodromeIntegration.address)
            );
            console.log(
              "USDC LEFT: ",
              await getBalance(addresses.USDC, velodromeIntegration.address)
            );
            console.log(
              "DAI LEFT: ",
              await getBalance(addresses.DAI, velodromeIntegration.address)
            );
          }

          {
            // Withdraw
            const poolAddress = velodromePools.WETH_USDC;
            const liquidityAmount = await velodromeIntegration.getBalance(
              poolAddress,
              otherAccount.address
            );
            const exitTokenAddress = addresses.USDT;
            const minExitTokenAmount = 0;
            const underlyingTarget = addresses.ZERO_ADDRESS;
            const targetWithdrawTokenAddress = addresses.USDC;
            const swapTarget = addresses.ONE_INCH;
            const underlyingReturnAmount =
              await velodromeIntegration.removeAssetReturn(
                poolAddress,
                targetWithdrawTokenAddress,
                liquidityAmount
              );
            console.log(underlyingReturnAmount.toString());

            const swapTargetApiResponse = await getOneInchApiResponse(
              ethers.provider.network.chainId,
              targetWithdrawTokenAddress,
              underlyingReturnAmount,
              exitTokenAddress,
              velodromeIntegration.address
            );
            const swapData = swapTargetApiResponse.tx.data;
            const affiliate = addresses.ZERO_ADDRESS;

            await approve(
              otherAccount,
              poolAddress,
              velodromeIntegration.address,
              liquidityAmount
            );

            console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);

            await velodromeIntegration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              );

            console.log(
              "WETH LEFT: ",
              await getBalance(addresses.WETH, velodromeIntegration.address)
            );
            console.log(
              "USDT LEFT: ",
              await getBalance(addresses.USDT, velodromeIntegration.address)
            );
            console.log(
              "USDC LEFT: ",
              await getBalance(addresses.USDC, velodromeIntegration.address)
            );
            console.log(
              "DAI LEFT: ",
              await getBalance(addresses.DAI, velodromeIntegration.address)
            );

            console.log(`...done`);
          }
        });

        it("Should deposit ETH to DAI-USDC pool, and withdraw correct amount of USDT.", async () => {
          const { otherAccount, velodromeIntegration, goodwill } =
            await loadFixture(deployVelodromeIntegration);

          { // Deposit
            const entryTokenAddress = addresses.ETH;
            const entryTokenAmount = ethers.utils.parseEther("10");

            const poolAddress = velodromePools.USDC_DAI;
            const depositTokenAddress = addresses.USDC;
            const minExitTokenAmount = 0;
            const underlyingTarget = addresses.ZERO_ADDRESS;
            const targetDepositTokenAddress = addresses.ZERO_ADDRESS;
            const swapTarget = addresses.ONE_INCH;
            const goodwillPortion = entryTokenAmount.mul(goodwill).div(10000);

            const swapTargetApiResponse = await getOneInchApiResponse(
              ethers.provider.network.chainId,
              entryTokenAddress,
              entryTokenAmount.sub(goodwillPortion),
              depositTokenAddress,
              velodromeIntegration.address
            );

            const swapData = swapTargetApiResponse.tx.data;
            const affiliate = addresses.ZERO_ADDRESS;

            console.log(`Depositing ${entryTokenAddress} to ${poolAddress}.`);

            await expect(
              velodromeIntegration
                .connect(otherAccount)
                .deposit(
                  entryTokenAddress,
                  entryTokenAmount,
                  poolAddress,
                  depositTokenAddress,
                  minExitTokenAmount,
                  underlyingTarget,
                  targetDepositTokenAddress,
                  swapTarget,
                  swapData,
                  affiliate,
                  { value: entryTokenAmount }
                )
            ).to.be.fulfilled;

            console.log(`...done`);
            console.log(
              "DAI LEFT: ",
              await getBalance(addresses.DAI, velodromeIntegration.address)
            );
            console.log(
              "ETH LEFT: ",
              await ethers.provider.getBalance(velodromeIntegration.address)
            );
            console.log(
              "USDC LEFT: ",
              await getBalance(addresses.USDC, velodromeIntegration.address)
            );
            console.log("LP TOKENS GOT: ", await getBalance(poolAddress, otherAccount.address));
          }

          { // Withdraw
            const poolAddress = velodromePools.USDC_DAI;
            const liquidityAmount = await velodromeIntegration.getBalance(
              poolAddress,
              otherAccount.address
            );
            
            const exitTokenAddress = addresses.USDT;
            const minExitTokenAmount = 0;
            const underlyingTarget = addresses.ZERO_ADDRESS;
            const targetWithdrawTokenAddress = addresses.USDC;
            const swapTarget = addresses.ONE_INCH;
            const underlyingReturnAmount =
              await velodromeIntegration.removeAssetReturn(
                poolAddress,
                targetWithdrawTokenAddress,
                liquidityAmount
              );
            console.log(underlyingReturnAmount.toString());

            const swapTargetApiResponse = await getOneInchApiResponse(
              ethers.provider.network.chainId,
              targetWithdrawTokenAddress,
              underlyingReturnAmount,
              exitTokenAddress,
              velodromeIntegration.address
            );
            const swapData = swapTargetApiResponse.tx.data;
            const affiliate = addresses.ZERO_ADDRESS;

            await approve(
              otherAccount,
              poolAddress,
              velodromeIntegration.address,
              liquidityAmount
            );

            console.log(`Withdrawing ${exitTokenAddress} from ${poolAddress}.`);

            await velodromeIntegration
              .connect(otherAccount)
              .withdraw(
                poolAddress,
                liquidityAmount,
                exitTokenAddress,
                minExitTokenAmount,
                underlyingTarget,
                targetWithdrawTokenAddress,
                swapTarget,
                swapData,
                affiliate
              );

            console.log(
              "ETH LEFT: ",
              await ethers.provider.getBalance(velodromeIntegration.address)
            );
            console.log(
              "USDC LEFT: ",
              await getBalance(addresses.USDC, velodromeIntegration.address)
            );
            console.log(
              "DAI LEFT: ",
              await getBalance(addresses.DAI, velodromeIntegration.address)
            );
            console.log(
              "USDT GOT BY OWNER: ",
              await getBalance(addresses.USDT, otherAccount.address)
            );

            console.log(`...done`);
          }
        });
      });
    });
  });
});

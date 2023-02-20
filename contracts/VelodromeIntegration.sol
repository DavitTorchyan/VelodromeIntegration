// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {CoinStatsBaseV1, SafeERC20, IERC20} from "./CoinStatsBaseV1.sol";
import {IntegrationInterface} from "./IntegrationInterface.sol";
import "hardhat/console.sol";


interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256) external;
}

interface IRouter {
    function pairFor(
        address tokenA,
        address tokenB,
        bool stable
    ) external view returns (address pair);

    function addLiquidity(address tokenA, address tokenB, bool stable, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns(uint amountA, uint amountB, uint liquidity);

    function removeLiquidity(address tokenA, address tokenB, bool stable, uint liquidity, uint amounAMin, uint amountBMin, address to, uint deadline) external returns(uint amountA, uint amountB);

    function swapExactTokensForTokensSimple(uint amountIn, uint amountOutMin, address tokenFrom, address tokenTo, bool stable, address to, uint deadline) external returns (uint[] memory amounts);

    function getAmountOut(uint amountIn, address tokenIn, address tokenOut) external view returns(uint amount, bool stable);
}

interface IVelodromePair {
    function metadata()
        external
        view
        returns (
            uint dec0,
            uint dec1,
            uint r0,
            uint r1,
            bool st,
            address t0,
            address t1
        );

    function tokens() external view returns (address, address);

    function totalSupply() external view returns(uint);

    function getReserves()
        external
        view
        returns (uint _reserve0, uint _reserve1, uint _blockTimestampLast);

    function getAmountOut(uint amountIn, address tokenIn) external view returns (uint);
}

interface IVelodromeFactory {
    function allPairsLength() external view returns (uint);

    function isPair(address pair) external view returns (bool);

    function getFee(bool _stable) external view returns(uint256);

    function getPair(
        address tokenA,
        address token,
        bool stable
    ) external view returns (address);

    function createPair(
        address tokenA,
        address tokenB,
        bool stable
    ) external returns (address pair);
}

contract VelodromeIntegration is CoinStatsBaseV1, IntegrationInterface {
    using SafeERC20 for IERC20;

    IRouter public velodromeRouter = IRouter(0x9c12939390052919aF3155f41Bf4160Fd3666A6f);
    IVelodromeFactory public velodromeFactory = IVelodromeFactory(0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746);

    address immutable WETH = 0x4200000000000000000000000000000000000006;

    event Deposit(
        address indexed from,
        address indexed pool,
        address token,
        uint256 amount,
        address affiliate
    );

    event Withdraw(
        address indexed from,
        address indexed pool,
        address token,
        uint256 amount,
        address affiliate
    );

    event FillQuoteSwap(
        address swapTarget,
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        uint256 outputTokenAmount
    );

    constructor(uint256 _goodWill, uint256 _affiliateSplit, address _vaultAddress) CoinStatsBaseV1(_goodWill, _affiliateSplit, _vaultAddress) {
        // 1inch router address
        approvedTargets[0x1111111254760F7ab3F16433eea9304126DCd199] = true;
    }

    function getBalance(
        address poolAddress,
        address account
    ) public view override returns (uint256 balance) {
        return IERC20(poolAddress).balanceOf(account);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _getSwapAmount(uint256 r, uint256 a) internal pure returns(uint256) {
        return(_sqrt(r * (r * 399920004 + a * 399920000)) - r * 19998) / 19996;
    }

    function deposit(
        address entryTokenAddress,
        uint256 entryTokenAmount,
        address poolAddress,
        address depositTokenAddress,
        uint256 minExitTokenAmount,
        address ,
        address ,
        address swapTarget,
        bytes calldata swapData,
        address affiliate
    ) external payable override {
        if(entryTokenAddress == address(0)) {
            entryTokenAddress = ETH_ADDRESS;
        }

        entryTokenAmount = _pullTokens(entryTokenAddress, entryTokenAmount);

        entryTokenAmount -= _subtractGoodwill(
            entryTokenAddress,
            entryTokenAmount,
            affiliate,
            true
        );

        entryTokenAmount = _fillQuote(entryTokenAddress, entryTokenAmount, depositTokenAddress, swapTarget, swapData);

        uint256 initialLiquidityBalance = _getBalance(poolAddress);
        uint256 liquidityRecieved = _addVelodromeLiquidity(poolAddress, depositTokenAddress, entryTokenAmount);

        require(liquidityRecieved >= minExitTokenAmount, "High slippage");

        IERC20(poolAddress).safeTransfer(msg.sender, _getBalance(poolAddress) - initialLiquidityBalance);

        emit Deposit(
            msg.sender,
            poolAddress,
            entryTokenAddress,
            entryTokenAmount,
            affiliate
        );

    }

    function _addVelodromeLiquidity(address poolAddress, address depositToken, uint256 amount) private returns(uint256 lpReceived) {
        (address token0, address token1) = IVelodromePair(poolAddress).tokens();

        ( , , , , bool stable, , ) = IVelodromePair(poolAddress).metadata(); 
        // bool stable = false;

        address pair = velodromeFactory.getPair(token0, token1, stable);

        require(pair != address(0), "Invalid pool address provided");

        (uint256 reserve0, uint256 reserve1, ) = IVelodromePair(pair).getReserves();

        uint256 swapAmount;
        if(token0 == depositToken) {
            swapAmount = _getSwapAmount(reserve0, amount);
            _makeVelodromeSwap(token0, token1, swapAmount, stable);
        } else {
            swapAmount = _getSwapAmount(reserve1, amount);
            _makeVelodromeSwap(token1, token0, swapAmount, stable);
        }

        _addLiquidity(token0, token1, stable);

        return(_getBalance(poolAddress));
    }

    function _makeVelodromeSwap(address _from, address _to, uint256 _amount, bool stable) private returns(uint256 amountOut) {
        _approveToken(_from, address(velodromeRouter), _amount);

        return velodromeRouter.swapExactTokensForTokensSimple(_amount, 1, _from, _to, stable, address(this), block.timestamp)[1];
    }

    function _addLiquidity(address token0, address token1, bool stable) private {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        _approveToken(token0, address(velodromeRouter), balance0);
        _approveToken(token1, address(velodromeRouter), balance1);

        velodromeRouter.addLiquidity(token0, token1, stable, balance0, balance1, 0, 0, msg.sender, block.timestamp);
    }



    function withdraw(
        address poolAddress,
        uint256 withdrawLiquidityAmount,
        address exitTokenAddress,
        uint256 minExitTokenAmount,
        address ,
        address targetWithdrawTokenAddress,
        address swapTarget,
        bytes calldata swapData,
        address affiliate
    ) external payable override {
        withdrawLiquidityAmount = _pullTokens(poolAddress, withdrawLiquidityAmount);

        _approveToken(poolAddress, address(velodromeRouter), withdrawLiquidityAmount);

        uint256 lpExitTokenAmount = _removeVelodromeLiquidity(poolAddress, withdrawLiquidityAmount, targetWithdrawTokenAddress);

        uint256 exitTokenAmount = _fillQuote(targetWithdrawTokenAddress, lpExitTokenAmount, exitTokenAddress, swapTarget, swapData);

        require(exitTokenAmount >= minExitTokenAmount, "Withdraw: High Slippage");

        exitTokenAmount -= _subtractGoodwill(exitTokenAddress, exitTokenAmount, affiliate, true);

        if(exitTokenAddress == ETH_ADDRESS) {
            (bool success, ) = msg.sender.call{value: exitTokenAmount}("");
            require(success, "Address: Unable to sedc value, recipient may have reverted");
        } else {
            IERC20(exitTokenAddress).safeTransfer(msg.sender, exitTokenAmount);
        }

        emit Withdraw(msg.sender, poolAddress, exitTokenAddress, exitTokenAmount, affiliate);
    }

    function _removeVelodromeLiquidity(address poolAddress, uint256 liquidityAmount, address exitTokenAddress) private returns(uint256 underlyingReceived) {
        (address token0, address token1) = IVelodromePair(poolAddress).tokens();

        require(exitTokenAddress == token0 || exitTokenAddress == token1, "Invalid exit token");

        ( , , , , bool stable, , ) = IVelodromePair(poolAddress).metadata();
        // bool stable = false;

        (uint256 amount0, uint256 amount1) = velodromeRouter.removeLiquidity(token0, token1, stable, liquidityAmount, 0, 0, address(this), block.timestamp);

        uint256 swapTokenReceived;
        if(exitTokenAddress == token0) {
            swapTokenReceived = _makeVelodromeSwap(token1, token0, amount1, stable);
        } else {
            swapTokenReceived = _makeVelodromeSwap(token0, token1, amount0, stable);
        }

        return _getBalance(exitTokenAddress);
    }

    function _fillQuote(
        address inputTokenAddress,
        uint256 inputTokenAmount,
        address outputTokenAddress,
        address swapTarget,
        bytes memory swapData
    ) internal returns (uint256 outputTokensBought) {
        if (swapTarget == address(0)) {
            return inputTokenAmount;
        }

        if (inputTokenAddress == outputTokenAddress) {
            return inputTokenAmount;
        }

        if (swapTarget == WETH) {
            if (
                outputTokenAddress == address(0) ||
                outputTokenAddress == ETH_ADDRESS
            ) {
                IWETH(WETH).withdraw(inputTokenAmount);
                return inputTokenAmount;
            } else {
                IWETH(WETH).deposit{value: inputTokenAmount}();
                return inputTokenAmount;
            }
        }

        uint256 value;
        if (inputTokenAddress == ETH_ADDRESS) {
            value = inputTokenAmount;
        } else {
            _approveToken(inputTokenAddress, swapTarget, inputTokenAmount);
        }

        uint256 initialOutputTokenBalance = _getBalance(outputTokenAddress);

        // solhint-disable-next-line reason-string
        require(
            approvedTargets[swapTarget],
            "FillQuote: Target is not approved"
        );

        (bool success, ) = swapTarget.call{value: value}(swapData);
        require(success, "FillQuote: Failed to swap tokens");

        outputTokensBought =
            _getBalance(outputTokenAddress) -
            initialOutputTokenBalance;

        // solhint-disable-next-line reason-string
        require(outputTokensBought > 0, "FillQuote: Swapped to invalid token");

        emit FillQuoteSwap(
            swapTarget,
            inputTokenAddress,
            inputTokenAmount,
            outputTokenAddress,
            outputTokensBought
        );
    }

    function removeAssetReturn(
        address poolAddress,
        address exitToken,
        uint256 liquidityAmount
    ) external view override returns (uint256) {
        require(liquidityAmount > 0, "RAR: Zero amount return");

        IVelodromePair pair = IVelodromePair(poolAddress);
        (address _token0, address _token1) = pair.tokens();

        uint256 _balance0 = IERC20(_token0).balanceOf(poolAddress);
        uint256 _balance1 = IERC20(_token1).balanceOf(poolAddress);

        uint256 _totalSupply = pair.totalSupply();

        uint256 amount0 = (liquidityAmount * _balance0) / _totalSupply;
        uint256 amount1 = (liquidityAmount * _balance1) / _totalSupply;

        if (exitToken == _token0) {
            (uint256 returnAmount, bool stable) = velodromeRouter.getAmountOut(
                    amount1,
                    _token1,
                    _token0
                );
            console.log("Stable------: ", stable);
            return returnAmount + amount0;
        } else {
            (uint256 returnAmount, bool stable) = velodromeRouter.getAmountOut(
                    amount0,
                    _token0,
                    _token1
                );
            console.log("Stable______: ", stable);
            return returnAmount + amount1;
        }
    }
}

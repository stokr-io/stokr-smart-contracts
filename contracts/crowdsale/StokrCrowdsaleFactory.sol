pragma solidity 0.4.25;

import "../token/StokrToken.sol";
import "./RateSourceInterface.sol";
import "./StokrCrowdsale.sol";

// Helper contract to deploy a new StokrCrowdsale contract

contract StokrCrowdsaleFactory {

    function createNewCrowdsale(
        StokrToken token,
        uint tokenPrice,
        uint[6] amounts,  // [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal,
                          //  tokenPurchaseMinimum, tokenPurchaseLimit, tokenReservePerMill]
        uint[3] period,   // [openingTime, closingTime, limitEndTime]
        address[2] wallets  // [companyWallet, reserveAccount]
    )
        external
        returns (StokrCrowdsale)
    {
        StokrCrowdsale crowdsale = new StokrCrowdsale(
            RateSource(msg.sender),  // rateSource
            token,
            amounts[0],   // tokenCapOfPublicSale
            amounts[1],   // tokenCapOfPrivateSale
            amounts[2],   // tokenGoal
            amounts[3],   // tokenPurchaseMinimum
            amounts[4],   // tokenPurchaseLimit
            amounts[5],   // tokenReservePerMill
            tokenPrice,   // tokenPrice
            period[0],    // openingTime
            period[1],    // closingTime
            period[2],    // limitEndTime
            wallets[0],   // companyWallet
            wallets[1]);  // reserveAccount

        crowdsale.transferOwnershipUnsafe(msg.sender);

        return crowdsale;
    }

}

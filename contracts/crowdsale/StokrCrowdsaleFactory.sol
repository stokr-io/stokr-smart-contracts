pragma solidity 0.4.24;

import "../token/StokrToken.sol";
import "./RateSourceInterface.sol";
import "./StokrCrowdsale.sol";


contract StokrCrowdsaleFactory {

    function createNewCrowdsale(
        StokrToken token,
        uint tokenPrice,
        uint[5] amounts,  // [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal,
                          //  tokenPurchaseMinimum, tokenReservePerMill]
        uint[2] period,  // [openingTime, closingTime]
        address[2] wallets  // [companyWallet, reserveAccount]
    )
        public
        returns (StokrCrowdsale)
    {
        StokrCrowdsale crowdsale = new StokrCrowdsale(
            RateSource(msg.sender),  // rateSource
            token,
            amounts[0],  // tokenCapOfPublicSale
            amounts[1],  // tokenCapOfPrivateSale
            amounts[2],  // tokenGoal
            amounts[3],  // tokenPurchaseMinimum
            amounts[4],  // tokenReservePerMill
            tokenPrice,  // tokenPrice
            period[0],  // openingTime
            period[1],  // closingTime
            wallets[0],  // companyWallet
            wallets[1]);  // reserveAccount

        crowdsale.transferOwnership(msg.sender);

        return crowdsale;
    }

}

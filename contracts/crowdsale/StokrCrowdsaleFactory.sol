pragma solidity 0.4.24;

import "../token/StokrToken.sol";
import "./StokrCrowdsale.sol";


contract StokrCrowdsaleFactory {

    function createNewCrowdsale(
        StokrToken token,
        uint tokenPrice,
        uint etherRate,
        uint[4] caps,  // [tokenCapOfPublicSale, tokenCapOfPrivateSale, tokenGoal, tokenReserve]
        uint[2] times,  // [tokenPrice, etherRate]
        address[2] wallets  // [companyWallet, reserveAccount]
    )
        public
        returns (StokrCrowdsale)
    {
        StokrCrowdsale crowdsale = new StokrCrowdsale(
            token,
            caps[0],  // tokenCapOfPublicSale
            caps[1],  // tokenCapOfPrivateSale
            caps[2],  // tokenGoal
            tokenPrice,  // tokenPrice
            etherRate,  // etherRate
            msg.sender,  // rateAdmin
            times[0],  // openingTime
            times[1],  // closingTime
            wallets[0],  // companyWallet
            caps[3],  // tokenReserve
            wallets[1]);  // reserveAccount

        crowdsale.transferOwnership(msg.sender);

        return crowdsale;
    }

}


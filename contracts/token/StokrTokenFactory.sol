pragma solidity 0.4.25;

import "../whitelist/Whitelist.sol";
import "./StokrToken.sol";

// Helper contract to deploy a new StokrToken contract

contract StokrTokenFactory {

    function createNewToken(
        string name,
        string symbol,
        Whitelist whitelist,
        address profitDepositor,
        address profitDistributor,
        address keyRecoverer
    )
        public
        returns (StokrToken)
    {
        StokrToken token = new StokrToken(
            name,
            symbol,
            whitelist,
            profitDepositor,
            profitDistributor,
            keyRecoverer);

        token.transferOwnership(msg.sender);

        return token;
    }

}

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
            keyRecoverer);

        token.transferOwnership(msg.sender);

        return token;
    }

}

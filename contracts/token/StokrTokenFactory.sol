pragma solidity 0.4.24;

import "../whitelist/Whitelist.sol";
import "./StokrToken.sol";


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


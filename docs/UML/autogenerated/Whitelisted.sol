pragma solidity 0.4.24;

import "Ownable.sol";
import "./Whitelist.sol";


/// @title Whitelisted
/// @author Autogenerated from a Dia UML diagram
contract Whitelisted is Ownable {

    Whitelist public whitelist;

    /// @dev Log entry on whitelist changed
    /// @param newWhitelist An Ethereum address
    event WhitelistChanged(address newWhitelist);

    /// @dev Ensure only whitelisted
    /// @param _address An Ethereum address
    modifier onlyWhitelisted(address _address) {
        require(IMPLEMENTATION);
        _;
    }

    /// @dev Constructor
    /// @param _whitelist An Ethereum address
    constructor(address _whitelist) public {
        require(IMPLEMENTATION);
    }

    /// @dev Set whitelist
    /// @param _newWhitelist An Ethereum address
    function setWhitelist(address _newWhitelist) public onlyOwner {
        require(IMPLEMENTATION);
    }

}

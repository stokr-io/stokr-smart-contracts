pragma solidity 0.4.25;

import "../ownership/Ownable.sol";
import "./Whitelist.sol";


/// @title Whitelisted
/// @author STOKR
contract Whitelisted is Ownable {

    Whitelist public whitelist;

    /// @dev  Log entry on change of whitelist contract instance
    /// @param previous  Ethereum address of previous whitelist
    /// @param current   Ethereum address of new whitelist
    event WhitelistChange(address indexed previous, address indexed current);

    /// @dev Ensure only whitelisted addresses can call
    modifier onlyWhitelisted(address _address) {
        require(whitelist.isWhitelisted(_address), "Address is not whitelisted");
        _;
    }

    /// @dev Constructor
    /// @param _whitelist address of whitelist contract
    constructor(Whitelist _whitelist) public {
        setWhitelist(_whitelist);
    }

    /// @dev Set the address of whitelist
    /// @param _newWhitelist An Ethereum address
    function setWhitelist(Whitelist _newWhitelist) public onlyOwner {
        require(address(_newWhitelist) != address(0x0), "Whitelist address is zero");

        if (address(_newWhitelist) != address(whitelist)) {
            emit WhitelistChange(address(whitelist), address(_newWhitelist));

            whitelist = Whitelist(_newWhitelist);
        }
    }

}

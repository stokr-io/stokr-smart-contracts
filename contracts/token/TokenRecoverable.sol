pragma solidity 0.5.12;

import "../ownership/Ownable.sol";


/// @title TokenRecoverable
/// @author STOKR
contract TokenRecoverable is Ownable {

    // Address that can do the TokenRecovery
    address public tokenRecoverer;

    /// @dev  Event emitted when the TokenRecoverer changes
    /// @param previous  Ethereum address of previous token recoverer
    /// @param current   Ethereum address of new token recoverer
    event TokenRecovererChange(address indexed previous, address indexed current);

    /// @dev Event emitted in case of a TokenRecovery
    /// @param oldAddress Ethereum address of old account
    /// @param newAddress Ethereum address of new account
    event TokenRecovery(address indexed oldAddress, address indexed newAddress);

    /// @dev Restrict operation to token recoverer
    modifier onlyTokenRecoverer() {
        require(msg.sender == tokenRecoverer, "Restricted to token recoverer");
        _;
    }

    /// @dev Constructor
    /// @param _tokenRecoverer Ethereum address of token recoverer
    constructor(address _tokenRecoverer) public {
        setTokenRecoverer(_tokenRecoverer);
    }

    /// @dev Set token recoverer
    /// @param _newTokenRecoverer Ethereum address of new token recoverer
    function setTokenRecoverer(address _newTokenRecoverer) public onlyOwner {
        require(_newTokenRecoverer != address(0x0), "New token recoverer is zero");

        if (_newTokenRecoverer != tokenRecoverer) {
            emit TokenRecovererChange(tokenRecoverer, _newTokenRecoverer);

            tokenRecoverer = _newTokenRecoverer;
        }
    }

    /// @dev Recover token
    /// @param _oldAddress address
    /// @param _newAddress address
    function recoverToken(address _oldAddress, address _newAddress) public;

}

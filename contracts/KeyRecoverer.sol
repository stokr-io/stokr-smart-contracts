pragma solidity 0.4.23;

import "../zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./KeyRecoverable.sol";


/// @title SicosToken
/// @author C+B
contract KeyRecoverer is Ownable {

     // Indices of tokens within array. Note: There's no valid token at index 0.
    mapping(address => uint) public indices;
     // Array of tokens. Note: At index 0 is a placeholder that shouldn't be removed ever.
    address[] public tokens;

    /// @dev Constructor
    constructor() public {
        tokens.push(address(0x0));  // Placeholder at index 0.
    }

    /// @dev Check if a token is registered here
    /// @param _token Ethereum address of token contract instance
    /// @return True or false
    function containsToken(address _token) public view returns (bool) {
        return indices[_token] > 0;
    }

    /// @dev Register a key recoverable token
    /// @param _token Ethereum address of token contract instance
    function addToken(address _token) public onlyOwner {
        require(_token != address(0x0) && !containsToken(_token));

        indices[_token] = tokens.length;
        tokens.push(_token);
    }

    /// @dev Unregister a key recoverable token
    /// @param _token Ethereum address of token contract instance
    function removeToken(address _token) public onlyOwner {
        require(_token != address(0x0) && containsToken(_token));

        // Array index of token to delete.
        uint index = indices[_token];

        // Remove token from array.
        tokens[index] = tokens[tokens.length - 1];
        tokens.length = tokens.length - 1;

        // Update token indices.
        indices[tokens[index]] = index;
        delete indices[_token];
    }

    /// @dev Recover key for an investor in all tokens that are registered here
    /// @param _oldAddress Old Ethereum address of the investor
    /// @param _newAddress New Ethereum address of the investor
    function recoverKey(address _oldAddress, address _newAddress) public onlyOwner {
        for (uint i=1; i < tokens.length; i++) {
            if (KeyRecoverable(tokens[i]).keyRecoverer() == address(this)) {
                KeyRecoverable(tokens[i]).recoverKey(_oldAddress, _newAddress);
            }
        }
    }

    /// @dev Check if this instance is the keyRecoverer of all registered tokens.
    /// @return True or false
    function checkTokens() public view onlyOwner returns (bool) {
        for (uint i=1; i < tokens.length; i++) {
            if (KeyRecoverable(tokens[i]).keyRecoverer() == address(this)) {
                return false;
            }
        }
        return true;
    }

}

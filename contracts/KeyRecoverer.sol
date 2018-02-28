pragma solidity 0.4.19;

import "../zeppelin-solidity/contracts/ownership/Ownable.sol";


interface SicosToken {

    function recoverKey(address _oldAddress, address _newAddress) public;
    function keyRecoverer() public returns (address);

}


interface Whitelist {

    function addToWhitelist(address[] _investors) public;

}


contract KeyRecoverer is Ownable {

     // Indices of tokens within array. Note: There's no valid token at index 0.
    mapping(address => uint) public indices; 
     // Array of tokens. Note: At index 0 is a placeholder that shouldn't be removed ever.
    address[] public tokens; 

    function KeyRecoverer() public {
        tokens.push(address(0));  // Placeholder at index 0.
    }

    function containsToken(address _token) public view returns (bool) {
        return indices[_token] > 0;
    }

    function addToken(address _token) public onlyOwner {
        require(_token != address(0) && !containsToken(_token));

        indices[_token] = tokens.length;
        tokens.push(_token);
    }

    function removeToken(address _token) public onlyOwner {
        require(_token != address(0) && containsToken(_token));

        // Array index of token to delete.
        uint index = indices[_token];

        // Remove token from array.
        tokens[index] = tokens[tokens.length - 1];
        tokens.length = tokens.length - 1;

        // Update token indices.
        indices[tokens[index]] = index;
        delete indices[_token];
    }

    function recoverKey(address _oldAddress, address _newAddress) public onlyOwner {
        for (uint i=1; i < tokens.length; i++) {
            if (SicosToken(tokens[i]).keyRecoverer() == address(this)) {
                SicosToken(tokens[i]).recoverKey(_oldAddress, _newAddress);   
            }

        }
    }

    function check() public onlyOwner returns (bool) {
        for (uint i=1; i < tokens.length; i++) {
            if (SicosToken(tokens[i]).keyRecoverer() == address(this)) {
                return false; 
            }

        }
        return true;
    }

}

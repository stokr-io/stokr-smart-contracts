pragma solidity 0.4.24;

import "./EIP137ResolverInterface.sol";

contract ENSResolver is EIP137ResolverInterface {

    event AddrChanged(bytes32 indexed node, address a);


    function supportsInterface(bytes4 interfaceID) constant returns (bool) {
        return interfaceID == 0x01ffc9a7 || interfaceID == 0x3b3b57de;
    }

    function addr(bytes32 node) constant returns (address) {
    }

}


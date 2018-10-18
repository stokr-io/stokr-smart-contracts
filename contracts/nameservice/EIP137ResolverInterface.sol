pragma solidity 0.4.24;
// EIP 137 Resolver

interface EIP137ResolverInterface {

    event AddrChanged(bytes32 indexed node, address a);

    function supportsInterface(bytes4 interfaceID) constant returns (bool);

    function addr(bytes32 node) constant returns (address);

}


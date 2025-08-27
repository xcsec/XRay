import { Button, Flex, Text } from "@chakra-ui/react";
import React from "react";
import { Link } from "react-router-dom";

export const NoHistory = () => (
  <Flex
    w="100%"
    background="white"
    borderRadius="1rem"
    p={8}
    direction="column"
    align="center"
  >
    <Text fontWeight="bold" mt={8}>
      No History Found
    </Text>
    <Link to="/">
      <Button color="blue" mt={4}>
        Make Transfer
      </Button>
    </Link>
  </Flex>
);

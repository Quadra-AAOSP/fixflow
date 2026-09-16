package com.example.fixflow;

import org.springframework.boot.SpringApplication;

public class TestFixflowApplication {

	public static void main(String[] args) {
		SpringApplication.from(FixflowApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}

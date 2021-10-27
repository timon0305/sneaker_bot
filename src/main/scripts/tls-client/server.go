package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", Route)
	fmt.Println("[MAIN - GO] - TLS CLIENT LISTENING ON 3005")
	http.ListenAndServe(":3005", nil)
}

func Route(w http.ResponseWriter, r *http.Request) {
	Handle(w, r)
}

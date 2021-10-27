package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	tls "github.com/refraction-networking/utls"
	"github.com/x04/cclient"
)

type Response struct {
	status  int
	body    string
	headers http.Header
}

func Handle(w http.ResponseWriter, r *http.Request) {
	var obj = r.FormValue
	fmt.Println(obj("method") + " - " + obj("uri"))
	var client, _ = cclient.NewClient(tls.HelloChrome_83, obj("proxy"))

	var req *http.Request

	if obj("body") != "" {
		var jsonStr = []byte(obj("body"))
		req, _ = http.NewRequest(obj("method"), obj("uri"), bytes.NewBuffer(jsonStr))
	} else if obj("form") != "" {
		var formData = url.Values{}
		var form map[string]interface{}
		json.Unmarshal([]byte(obj("form")), &form)
		for key, value := range form {
			str1, ok1 := interface{}(key).(string)
			str2, ok2 := value.(string)
			if ok1 && ok2 {
				formData.Add(str1, str2)
			}
		}
		req, _ = http.NewRequest(obj("method"), obj("uri"), strings.NewReader(formData.Encode()))
	} else {
		req, _ = http.NewRequest(obj("method"), obj("uri"), nil)
	}
	HandleHeaders(obj("headers"), req)
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println(err.Error())
		return
	}
	defer resp.Body.Close()
	respBody, err := readAndClose(resp.Body)
	if err != nil {
		return
	}
	var HeaderString, _ = json.Marshal(resp.Header)
	fmt.Fprintf(w, `{statusCode}`+strconv.Itoa(resp.StatusCode)+`{/statusCode}, {body}`+BytesToString(respBody)+`{/body}, {headers}`+BytesToString(HeaderString)+`{/headers}`)
}

func HandleHeaders(headers string, req *http.Request) *http.Request {
	var obj map[string]interface{}
	json.Unmarshal([]byte(headers), &obj)
	for key, value := range obj {
		str1, ok1 := interface{}(key).(string)
		str2, ok2 := value.(string)
		if ok1 && ok2 {
			req.Header.Set(str1, str2)
		}
	}
	req.Header.Set("User-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36")
	return req
}

func HandleFormOptions(formdatas string, req *http.Request) *http.Request {
	if formdatas != "" {
		var formData = url.Values{}
		var form map[string]interface{}
		json.Unmarshal([]byte(formdatas), &form)
		for key, value := range form {
			str1, ok1 := interface{}(key).(string)
			str2, ok2 := value.(string)
			if ok1 && ok2 {
				fmt.Println(str1 + " : " + str2)
				formData.Add(str1, str2)
			}
		}
		req.PostForm = formData
	}
	return req
}

func readAndClose(r io.ReadCloser) ([]byte, error) {
	readBytes, err := ioutil.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return readBytes, r.Close()
}

func BytesToString(data []byte) string {
	return string(data[:])
}
